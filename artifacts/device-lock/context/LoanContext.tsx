import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCustomerAccountQueryKey,
  useActivateCustomerAccount,
  useGetCustomerAccount,
  useLoginCustomer,
  useLogoutCustomer,
  type CustomerAccount,
} from "@workspace/api-client-react";
import {
  lockDeviceNow,
  setCreditProtectionEnabled,
  setFrpAccounts,
  setKioskLockEnabled,
} from "expo-device-admin";
import { API_BASE_URL, API_IS_CONFIGURED } from "@/lib/api-config";
import {
  applyDemoLoanStatus,
  applyDemoPaymentToLoan,
  buildDemoPayment,
  buildInitialDemoLoan,
  buildInitialDemoPayments,
} from "@/lib/demo-data";

export type LoanStatus = "active" | "due_soon" | "overdue" | "locked" | "completed";
export type PaymentMethod = "cash" | "transfer" | "card";
export type PaymentStatus = "completed" | "pending" | "failed";

export interface Loan {
  id: number;
  totalAmount: number;
  paidAmount: number;
  monthlyPayment: number;
  nextDueDate: string;
  status: LoanStatus;
  deviceModel: string;
  clientName: string;
  startDate: string;
  totalMonths: number;
  paidMonths: number;
  gracePeriodDays: number;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference: string;
  status: PaymentStatus;
}

interface LoanContextType {
  loan: Loan | null;
  payments: Payment[];
  clientName: string | null;
  isDeviceLocked: boolean;
  daysUntilDue: number;
  progressPercent: number;
  isPaymentModalOpen: boolean;
  openPaymentModal: () => void;
  closePaymentModal: () => void;
  makePay: (amount: number, method: PaymentMethod) => Promise<void>;
  setLoanStatus: (status: LoanStatus) => void;
  resetDemo: () => void;
  enterDemoMode: () => void;
  login: (phone: string, password: string) => Promise<void>;
  activate: (code: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasSession: boolean;
  apiConfigured: boolean;
  syncError: string | null;
}

const LoanContext = createContext<LoanContextType | null>(null);
export const CUSTOMER_SESSION_KEY = "finjoy.customer.session";
const SESSION_KEY = CUSTOMER_SESSION_KEY;
const CACHED_ACCOUNT_KEY = "finjoy.customer.cached_account";

function daysUntilDate(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Evaluates due-date rules locally on the device so that even if the user
 * disables Wi-Fi and mobile data before the payment date, the APK still
 * transitions to "overdue" / "locked" automatically when the date arrives.
 */
function resolveEffectiveLoanStatus(loan: Loan, daysUntilDue: number): LoanStatus {
  if (loan.status === "completed" || loan.status === "locked") {
    return loan.status;
  }
  const daysOverdue = -daysUntilDue;
  if (daysOverdue > loan.gracePeriodDays) {
    return "locked";
  }
  if (daysOverdue >= 0) {
    return loan.gracePeriodDays <= 0 ? "locked" : "overdue";
  }
  if (daysUntilDue <= 3) {
    return "due_soon";
  }
  return loan.status;
}

function accountErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function accountErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No fue posible sincronizar la información de tu cuenta.";
}

function mapAccount(account: CustomerAccount) {
  const loan: Loan | null = account.loan
    ? {
        id: account.loan.id,
        totalAmount: account.loan.totalAmount,
        paidAmount: account.loan.paidAmount,
        monthlyPayment: account.loan.monthlyPayment,
        nextDueDate: account.loan.nextDueDate,
        status: account.loan.status as LoanStatus,
        deviceModel: account.loan.deviceModel,
        clientName: account.client.name,
        startDate: account.loan.startDate,
        totalMonths: account.loan.totalMonths,
        paidMonths: account.loan.paidMonths,
        gracePeriodDays: account.loan.gracePeriodDays,
      }
    : null;
  return {
    loan,
    payments: account.payments.map((payment) => ({
      ...payment,
      id: String(payment.id),
      method: payment.method as PaymentMethod,
      status: payment.status as PaymentStatus,
    })),
  };
}

export function LoanProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [cachedAccount, setCachedAccount] = useState<CustomerAccount | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!API_IS_CONFIGURED);
  const [demoLoan, setDemoLoan] = useState<Loan>(() => buildInitialDemoLoan());
  const [demoPayments, setDemoPayments] = useState<Payment[]>(() => buildInitialDemoPayments());
  const [, setClockTick] = useState(0);
  const wasLockedRef = useRef(false);

  const activateMutation = useActivateCustomerAccount();
  const loginMutation = useLoginCustomer();
  const logoutMutation = useLogoutCustomer();
  const accountQuery = useGetCustomerAccount({
    query: {
      queryKey: getGetCustomerAccountQueryKey(),
      enabled: Boolean(sessionToken) && API_IS_CONFIGURED && !isDemoMode,
      retry: false,
      refetchInterval: 60_000,
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setClockTick((tick) => tick + 1);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      SecureStore.getItemAsync(SESSION_KEY),
      SecureStore.getItemAsync(CACHED_ACCOUNT_KEY),
    ])
      .then(([token, rawCachedAccount]) => {
        if (cancelled) return;
        if (rawCachedAccount) {
          try {
            setCachedAccount(JSON.parse(rawCachedAccount) as CustomerAccount);
          } catch {
            // Ignore malformed cache
          }
        }
        if (token) {
          setSessionToken(token);
          if (API_IS_CONFIGURED) {
            setIsDemoMode(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setSessionToken(null);
      })
      .finally(() => {
        if (!cancelled) setIsSessionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountQuery.data) return;
    setCachedAccount(accountQuery.data);
    void SecureStore.setItemAsync(
      CACHED_ACCOUNT_KEY,
      JSON.stringify(accountQuery.data),
    ).catch(() => undefined);
  }, [accountQuery.data]);

  useEffect(() => {
    if (accountErrorStatus(accountQuery.error) !== 401 || !sessionToken) return;
    void SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
    void SecureStore.deleteItemAsync(CACHED_ACCOUNT_KEY).catch(() => undefined);
    setSessionToken(null);
    setCachedAccount(null);
    queryClient.removeQueries({ queryKey: accountQuery.queryKey });
  }, [accountQuery.error, accountQuery.queryKey, queryClient, sessionToken]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && sessionToken && API_IS_CONFIGURED && !isDemoMode) {
        void accountQuery.refetch();
      }
    });
    return () => subscription.remove();
  }, [accountQuery.refetch, sessionToken, isDemoMode]);

  const saveSession = useCallback(
    async (token: string) => {
      await SecureStore.setItemAsync(SESSION_KEY, token);
      setSessionToken(token);
      setIsDemoMode(false);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const login = useCallback(
    async (phone: string, password: string) => {
      if (!API_IS_CONFIGURED) {
        throw new Error("Configura EXPO_PUBLIC_API_URL para conectar la app con el servidor.");
      }
      const session = await loginMutation.mutateAsync({
        data: { phone, password },
      });
      await saveSession(session.token);
    },
    [loginMutation, saveSession],
  );

  const activate = useCallback(
    async (code: string, password: string) => {
      if (!API_IS_CONFIGURED) {
        throw new Error("Configura EXPO_PUBLIC_API_URL para conectar la app con el servidor.");
      }
      const session = await activateMutation.mutateAsync({
        data: { code, password },
      });
      await saveSession(session.token);
    },
    [activateMutation, saveSession],
  );

  const logout = useCallback(async () => {
    try {
      if (sessionToken && !isDemoMode) await logoutMutation.mutateAsync();
    } catch {
      // Clear the local session even when the network is unavailable.
    } finally {
      await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
      await SecureStore.deleteItemAsync(CACHED_ACCOUNT_KEY).catch(() => undefined);
      setSessionToken(null);
      setCachedAccount(null);
      setIsDemoMode(false);
      queryClient.clear();
    }
  }, [logoutMutation, queryClient, sessionToken, isDemoMode]);

  const refreshAccount = useCallback(async () => {
    if (sessionToken && API_IS_CONFIGURED && !isDemoMode) {
      await accountQuery.refetch();
    }
  }, [accountQuery.refetch, sessionToken, isDemoMode]);

  const setLoanStatus = useCallback((status: LoanStatus) => {
    setIsDemoMode(true);
    setDemoLoan((prev) => applyDemoLoanStatus(prev, status));
  }, []);

  const resetDemo = useCallback(() => {
    setIsDemoMode(true);
    setDemoLoan(buildInitialDemoLoan());
    setDemoPayments(buildInitialDemoPayments());
  }, []);

  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
  }, []);

  const makePay = useCallback(
    async (amount: number, method: PaymentMethod) => {
      if (isDemoMode || !API_IS_CONFIGURED || !sessionToken) {
        const newPayment = buildDemoPayment(amount, method);
        setDemoPayments((prev) => [newPayment, ...prev]);
        setDemoLoan((prev) => applyDemoPaymentToLoan(prev, amount));
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/customer/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ amount, method }),
      });

      if (!response.ok) {
        throw new Error("No se pudo procesar el pago.");
      }

      await accountQuery.refetch();
    },
    [accountQuery, isDemoMode, sessionToken],
  );

  const activeAccountData = accountQuery.data ?? cachedAccount;
  const currentAccount = activeAccountData ? mapAccount(activeAccountData) : null;
  const rawLoan = isDemoMode ? demoLoan : (currentAccount?.loan ?? null);
  const daysUntilDue = rawLoan ? daysUntilDate(rawLoan.nextDueDate) : 0;
  const loan = rawLoan
    ? {
        ...rawLoan,
        status: isDemoMode
          ? rawLoan.status
          : resolveEffectiveLoanStatus(rawLoan, daysUntilDue),
      }
    : null;
  const payments = isDemoMode ? demoPayments : (currentAccount?.payments ?? []);
  const clientName = isDemoMode ? demoLoan.clientName : (activeAccountData?.client.name ?? null);
  const progressPercent = loan
    ? Math.min((loan.paidMonths / loan.totalMonths) * 100, 100)
    : 0;
  const errorStatus = accountErrorStatus(accountQuery.error);
  const syncError =
    !isDemoMode && sessionToken && accountQuery.error && errorStatus !== 401
      ? accountErrorMessage(accountQuery.error)
      : null;
  const isLoading =
    isSessionLoading ||
    (!isDemoMode &&
      Boolean(sessionToken) &&
      API_IS_CONFIGURED &&
      accountQuery.isLoading &&
      !cachedAccount);
  const isAuthenticated = isDemoMode || Boolean(sessionToken && activeAccountData);
  const hasSession = isDemoMode || Boolean(sessionToken);
  const isDeviceLocked =
    loan?.status === "locked" || loan?.status === "overdue";
  const isUnauthenticatedInProd =
    !isSessionLoading && API_IS_CONFIGURED && !isDemoMode && !isAuthenticated;
  const shouldEnforceKiosk = isDeviceLocked || isUnauthenticatedInProd;
  const shouldProtectCredit = loan ? loan.status !== "completed" : true;
  const frpAccountIds = (
    activeAccountData as
      | (CustomerAccount & { protection?: { frpAccountIds?: string[] } })
      | null
  )?.protection?.frpAccountIds;

  useEffect(() => {
    if (Array.isArray(frpAccountIds) && frpAccountIds.length > 0) {
      void setFrpAccounts(frpAccountIds);
    }
  }, [frpAccountIds]);

  useEffect(() => {
    void setCreditProtectionEnabled(shouldProtectCredit);
  }, [shouldProtectCredit]);

  useEffect(() => {
    void setKioskLockEnabled(shouldEnforceKiosk);
    if (isDeviceLocked && !wasLockedRef.current) {
      void lockDeviceNow();
    }
    wasLockedRef.current = isDeviceLocked;
  }, [isDeviceLocked, shouldEnforceKiosk]);

  const contextValue = useMemo<LoanContextType>(
    () => ({
      loan,
      payments,
      clientName,
      isDeviceLocked,
      daysUntilDue,
      progressPercent,
      isPaymentModalOpen,
      openPaymentModal: () => setIsPaymentModalOpen(true),
      closePaymentModal: () => setIsPaymentModalOpen(false),
      makePay,
      setLoanStatus,
      resetDemo,
      enterDemoMode,
      login,
      activate,
      logout,
      refreshAccount,
      isLoading,
      isAuthenticated,
      hasSession,
      apiConfigured: API_IS_CONFIGURED || isDemoMode,
      syncError,
    }),
    [
      loan,
      payments,
      clientName,
      isDeviceLocked,
      daysUntilDue,
      progressPercent,
      isPaymentModalOpen,
      makePay,
      setLoanStatus,
      resetDemo,
      enterDemoMode,
      login,
      activate,
      logout,
      refreshAccount,
      isLoading,
      isAuthenticated,
      hasSession,
      isDemoMode,
      syncError,
    ],
  );

  return <LoanContext.Provider value={contextValue}>{children}</LoanContext.Provider>;
}

export function useLoan(): LoanContextType {
  const context = useContext(LoanContext);
  if (!context) throw new Error("useLoan must be used inside LoanProvider");
  return context;
}
