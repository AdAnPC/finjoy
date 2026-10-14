import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  useActivateCustomerAccount,
  useGetCustomerAccount,
  useLoginCustomer,
  useLogoutCustomer,
  type CustomerAccount,
} from "@workspace/api-client-react";
import { API_IS_CONFIGURED } from "@/lib/api-config";

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
const SESSION_KEY = "finjoy.customer.session";

function daysUntilDate(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const activateMutation = useActivateCustomerAccount();
  const loginMutation = useLoginCustomer();
  const logoutMutation = useLogoutCustomer();
  const accountQuery = useGetCustomerAccount({
    query: {
      enabled: Boolean(sessionToken) && API_IS_CONFIGURED,
      retry: false,
      refetchInterval: 60_000,
    },
  });

  useEffect(() => {
    let cancelled = false;
    void SecureStore.getItemAsync(SESSION_KEY)
      .then((token) => {
        if (!cancelled) setSessionToken(token);
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
    if (accountErrorStatus(accountQuery.error) !== 401 || !sessionToken) return;
    void SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
    setSessionToken(null);
    queryClient.removeQueries({ queryKey: accountQuery.queryKey });
  }, [accountQuery.error, accountQuery.queryKey, queryClient, sessionToken]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && sessionToken && API_IS_CONFIGURED) {
        void accountQuery.refetch();
      }
    });
    return () => subscription.remove();
  }, [accountQuery.refetch, sessionToken]);

  const saveSession = useCallback(
    async (token: string) => {
      await SecureStore.setItemAsync(SESSION_KEY, token);
      setSessionToken(token);
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
      if (sessionToken) await logoutMutation.mutateAsync();
    } catch {
      // Clear the local session even when the network is unavailable.
    } finally {
      await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
      setSessionToken(null);
      queryClient.clear();
    }
  }, [logoutMutation, queryClient, sessionToken]);

  const refreshAccount = useCallback(async () => {
    if (sessionToken && API_IS_CONFIGURED) {
      await accountQuery.refetch();
    }
  }, [accountQuery.refetch, sessionToken]);

  const currentAccount = accountQuery.data ? mapAccount(accountQuery.data) : null;
  const loan = currentAccount?.loan ?? null;
  const daysUntilDue = loan ? daysUntilDate(loan.nextDueDate) : 0;
  const progressPercent = loan
    ? Math.min((loan.paidMonths / loan.totalMonths) * 100, 100)
    : 0;
  const errorStatus = accountErrorStatus(accountQuery.error);
  const syncError =
    sessionToken && accountQuery.error && errorStatus !== 401
      ? accountErrorMessage(accountQuery.error)
      : null;
  const isLoading =
    isSessionLoading ||
    (Boolean(sessionToken) && API_IS_CONFIGURED && accountQuery.isLoading);
  const isAuthenticated = Boolean(sessionToken && accountQuery.data);
  const hasSession = Boolean(sessionToken);
  const isDeviceLocked =
    loan?.status === "locked" || loan?.status === "overdue";

  const contextValue = useMemo<LoanContextType>(
    () => ({
      loan,
      payments: currentAccount?.payments ?? [],
      clientName: accountQuery.data?.client.name ?? null,
      isDeviceLocked,
      daysUntilDue,
      progressPercent,
      isPaymentModalOpen,
      openPaymentModal: () => setIsPaymentModalOpen(true),
      closePaymentModal: () => setIsPaymentModalOpen(false),
      login,
      activate,
      logout,
      refreshAccount,
      isLoading,
      isAuthenticated,
      hasSession,
      apiConfigured: API_IS_CONFIGURED,
      syncError,
    }),
    [
      loan,
      currentAccount,
      accountQuery.data?.client.name,
      isDeviceLocked,
      daysUntilDue,
      progressPercent,
      isPaymentModalOpen,
      login,
      activate,
      logout,
      refreshAccount,
      isLoading,
      isAuthenticated,
      hasSession,
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
