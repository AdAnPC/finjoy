import { eq, notInArray } from "drizzle-orm";
import { db, loansTable, type Loan } from "@workspace/db";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DUE_SOON_THRESHOLD_DAYS = 3;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getDaysUntilDue(nextDueDate: Date | string, now = new Date()): number {
  const due = typeof nextDueDate === "string" ? new Date(nextDueDate) : nextDueDate;
  return Math.round((startOfLocalDay(due) - startOfLocalDay(now)) / MS_PER_DAY);
}

/**
 * Computes the automatic status for a loan based on its payment progress,
 * due date, and configured grace period.
 *
 * - "completed" and manually "locked" loans keep their status.
 * - Once the due date arrives (daysUntilDue <= 0), the loan becomes "overdue"
 *   (which locks the APK), or "locked" once gracePeriodDays is exceeded.
 * - Within 3 days before the due date, the loan becomes "due_soon".
 */
export function computeAutomaticLoanStatus(
  loan: Pick<
    Loan,
    | "status"
    | "nextDueDate"
    | "gracePeriodDays"
    | "paidAmount"
    | "totalAmount"
    | "paidMonths"
    | "totalMonths"
  >,
  now = new Date(),
): Loan["status"] {
  if (
    loan.status === "completed" ||
    loan.paidMonths >= loan.totalMonths ||
    Number(loan.paidAmount) >= Number(loan.totalAmount)
  ) {
    return "completed";
  }

  if (loan.status === "locked") {
    return "locked";
  }

  const daysUntilDue = getDaysUntilDue(loan.nextDueDate, now);
  const daysOverdue = -daysUntilDue;

  if (daysOverdue > loan.gracePeriodDays) {
    return "locked";
  }

  if (daysOverdue >= 0) {
    return loan.gracePeriodDays <= 0 ? "locked" : "overdue";
  }

  if (daysUntilDue <= DUE_SOON_THRESHOLD_DAYS) {
    return "due_soon";
  }

  return "active";
}

/**
 * Evaluates a single loan against current date rules and persists the status
 * change if it transitioned.
 */
export async function syncSingleLoanStatus(loan: Loan, now = new Date()): Promise<Loan> {
  const nextStatus = computeAutomaticLoanStatus(loan, now);
  if (nextStatus === loan.status) {
    return loan;
  }

  const [updated] = await db
    .update(loansTable)
    .set({ status: nextStatus })
    .where(eq(loansTable.id, loan.id))
    .returning();

  return updated ?? { ...loan, status: nextStatus };
}

/**
 * Synchronizes all non-completed, non-locked loans in the database so that
 * due-soon, overdue, and grace-period-expired loans transition automatically.
 */
export async function syncAllLoanStatuses(now = new Date()): Promise<void> {
  const candidateLoans = await db
    .select()
    .from(loansTable)
    .where(notInArray(loansTable.status, ["completed", "locked"]));

  await Promise.all(
    candidateLoans.map(async (loan) => {
      const nextStatus = computeAutomaticLoanStatus(loan, now);
      if (nextStatus !== loan.status) {
        await db
          .update(loansTable)
          .set({ status: nextStatus })
          .where(eq(loansTable.id, loan.id));
      }
    }),
  );
}
