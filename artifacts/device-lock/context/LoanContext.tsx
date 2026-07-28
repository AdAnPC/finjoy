import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type LoanStatus = 'active' | 'due_soon' | 'overdue' | 'locked' | 'completed';
export type PaymentMethod = 'cash' | 'transfer' | 'card';

export interface Loan {
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
  status: 'completed' | 'pending' | 'failed';
}

interface LoanContextType {
  loan: Loan | null;
  payments: Payment[];
  isDeviceLocked: boolean;
  daysUntilDue: number;
  progressPercent: number;
  isPaymentModalOpen: boolean;
  openPaymentModal: () => void;
  closePaymentModal: () => void;
  makePay: (amount: number, method: PaymentMethod) => Promise<void>;
  setLoanStatus: (status: LoanStatus) => void;
  resetDemo: () => Promise<void>;
  isLoading: boolean;
}

const LoanContext = createContext<LoanContextType | null>(null);

const LOAN_KEY = '@finjoy/loan';
const PAYMENTS_KEY = '@finjoy/payments';

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysUntilDate(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function computeStatus(loan: Loan): LoanStatus {
  if (loan.status === 'locked') return 'locked';
  if (loan.status === 'completed') return 'completed';
  if (loan.paidMonths >= loan.totalMonths) return 'completed';
  const days = daysUntilDate(loan.nextDueDate);
  if (days < 0) return 'overdue';
  if (days <= 3) return 'due_soon';
  return 'active';
}

function makeInitialLoan(): Loan {
  return {
    totalAmount: 15000,
    paidAmount: 5000,
    monthlyPayment: 1250,
    nextDueDate: addDays(3),
    status: 'due_soon',
    deviceModel: 'Samsung Galaxy A54',
    clientName: 'Carlos García',
    startDate: addDays(-120),
    totalMonths: 12,
    paidMonths: 4,
    gracePeriodDays: 3,
  };
}

function makeInitialPayments(): Payment[] {
  return [
    { id: '1', amount: 1250, date: addDays(-30), method: 'transfer', reference: 'TXN-20241201', status: 'completed' },
    { id: '2', amount: 1250, date: addDays(-60), method: 'cash', reference: 'TXN-20241101', status: 'completed' },
    { id: '3', amount: 1250, date: addDays(-90), method: 'card', reference: 'TXN-20241001', status: 'completed' },
    { id: '4', amount: 1250, date: addDays(-120), method: 'cash', reference: 'TXN-20240901', status: 'completed' },
  ];
}

export function LoanProvider({ children }: { children: React.ReactNode }) {
  const [loan, setLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loanStr, paymentsStr] = await Promise.all([
        AsyncStorage.getItem(LOAN_KEY),
        AsyncStorage.getItem(PAYMENTS_KEY),
      ]);

      if (loanStr) {
        const saved = JSON.parse(loanStr) as Loan;
        const updated = { ...saved, status: computeStatus(saved) };
        setLoan(updated);
        await AsyncStorage.setItem(LOAN_KEY, JSON.stringify(updated));
      } else {
        const init = makeInitialLoan();
        setLoan(init);
        await AsyncStorage.setItem(LOAN_KEY, JSON.stringify(init));
      }

      if (paymentsStr) {
        setPayments(JSON.parse(paymentsStr) as Payment[]);
      } else {
        const initP = makeInitialPayments();
        setPayments(initP);
        await AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(initP));
      }
    } catch {
      setLoan(makeInitialLoan());
      setPayments(makeInitialPayments());
    } finally {
      setIsLoading(false);
    }
  };

  const persistLoan = async (updated: Loan) => {
    setLoan(updated);
    try { await AsyncStorage.setItem(LOAN_KEY, JSON.stringify(updated)); } catch { /* noop */ }
  };

  const persistPayments = async (updated: Payment[]) => {
    setPayments(updated);
    try { await AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(updated)); } catch { /* noop */ }
  };

  const makePay = async (amount: number, method: PaymentMethod) => {
    if (!loan) return;
    const newPayment: Payment = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      amount,
      date: new Date().toISOString(),
      method,
      reference: 'TXN-' + Date.now().toString().slice(-8),
      status: 'completed',
    };
    const newPaidMonths = loan.paidMonths + 1;
    const nextDue = new Date(loan.nextDueDate);
    nextDue.setMonth(nextDue.getMonth() + 1);
    const updatedLoan: Loan = {
      ...loan,
      paidAmount: loan.paidAmount + amount,
      paidMonths: newPaidMonths,
      nextDueDate: nextDue.toISOString(),
      status: newPaidMonths >= loan.totalMonths ? 'completed' : 'active',
    };
    if (newPaidMonths >= loan.totalMonths) {
      updatedLoan.status = 'completed';
    } else {
      updatedLoan.status = computeStatus(updatedLoan);
    }
    await Promise.all([
      persistLoan(updatedLoan),
      persistPayments([newPayment, ...payments]),
    ]);
  };

  const setLoanStatus = useCallback((status: LoanStatus) => {
    if (!loan) return;
    let nextDueDate = loan.nextDueDate;
    if (status === 'overdue') nextDueDate = addDays(-5);
    else if (status === 'due_soon') nextDueDate = addDays(2);
    else if (status === 'active') nextDueDate = addDays(15);
    persistLoan({ ...loan, status, nextDueDate });
  }, [loan, payments]);

  const resetDemo = useCallback(async () => {
    const initLoan = makeInitialLoan();
    const initPay = makeInitialPayments();
    await Promise.all([
      AsyncStorage.setItem(LOAN_KEY, JSON.stringify(initLoan)),
      AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(initPay)),
    ]);
    setLoan(initLoan);
    setPayments(initPay);
  }, []);

  const isDeviceLocked = !!(loan && (loan.status === 'locked' || loan.status === 'overdue'));
  const daysUntilDue = loan ? daysUntilDate(loan.nextDueDate) : 0;
  const progressPercent = loan ? Math.min((loan.paidMonths / loan.totalMonths) * 100, 100) : 0;

  return (
    <LoanContext.Provider
      value={{
        loan,
        payments,
        isDeviceLocked,
        daysUntilDue,
        progressPercent,
        isPaymentModalOpen,
        openPaymentModal: () => setIsPaymentModalOpen(true),
        closePaymentModal: () => setIsPaymentModalOpen(false),
        makePay,
        setLoanStatus,
        resetDemo,
        isLoading,
      }}
    >
      {children}
    </LoanContext.Provider>
  );
}

export function useLoan(): LoanContextType {
  const ctx = useContext(LoanContext);
  if (!ctx) throw new Error('useLoan must be used inside LoanProvider');
  return ctx;
}
