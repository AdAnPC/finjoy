import { cn } from "@/lib/utils";

interface LoanProgressBarProps {
  paidAmount: number;
  totalAmount: number;
  size?: "sm" | "md";
  className?: string;
}

export function getLoanProgressPercent(
  paidAmount: number,
  totalAmount: number,
): number {
  if (totalAmount <= 0) return 0;
  return Math.min(100, (paidAmount / totalAmount) * 100);
}

export function LoanProgressBar({
  paidAmount,
  totalAmount,
  size = "md",
  className,
}: LoanProgressBarProps) {
  const progress = getLoanProgressPercent(paidAmount, totalAmount);
  const heightClass = size === "sm" ? "h-2" : "h-3";

  return (
    <div className={cn("rounded-full bg-muted", heightClass, className)}>
      <div
        className={cn("rounded-full bg-primary transition-all", heightClass)}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
