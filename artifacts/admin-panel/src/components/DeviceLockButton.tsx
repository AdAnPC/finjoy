import { Lock, Loader2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeviceLockToggle } from "@/hooks/use-device-lock";
import { cn } from "@/lib/utils";

interface DeviceLockButtonProps {
  loanId: number;
  status: string;
  mode?: "full" | "icon";
  lockLabel?: string;
  unlockLabel?: string;
  className?: string;
}

export function DeviceLockButton({
  loanId,
  status,
  mode = "full",
  lockLabel = "Bloquear dispositivo",
  unlockLabel = "Desbloquear dispositivo",
  className,
}: DeviceLockButtonProps) {
  const { toggleLock, isPending } = useDeviceLockToggle();
  const busy = isPending(loanId);
  const isLocked = status === "locked";
  const isCompleted = status === "completed";

  if (mode === "icon") {
    if (isCompleted) return null;
    return (
      <Button
        size="icon"
        variant="ghost"
        disabled={busy}
        title={isLocked ? "Desbloquear" : "Bloquear"}
        onClick={() => void toggleLock(loanId, status)}
        className={className}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : isLocked ? (
          <Unlock className="h-4 w-4 text-emerald-600" />
        ) : (
          <Lock className="h-4 w-4 text-red-500" />
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={() => void toggleLock(loanId, status)}
      disabled={busy || isCompleted}
      variant={isLocked ? "default" : "outline"}
      className={cn("gap-2", className)}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isLocked ? (
        <Unlock className="h-4 w-4" />
      ) : (
        <Lock className="h-4 w-4" />
      )}
      {isLocked ? unlockLabel : lockLabel}
    </Button>
  );
}
