import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLockDevice, useUnlockDevice } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function useDeviceLockToggle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const lock = useLockDevice();
  const unlock = useUnlockDevice();
  const [pendingLoanId, setPendingLoanId] = useState<number | null>(null);

  const toggleLock = useCallback(
    async (loanId: number, currentStatus: string) => {
      setPendingLoanId(loanId);
      const isLocked = currentStatus === "locked";
      try {
        if (isLocked) {
          await unlock.mutateAsync({ id: loanId });
        } else {
          await lock.mutateAsync({ id: loanId });
        }
        await queryClient.invalidateQueries();
        toast({
          title: isLocked
            ? "Dispositivo desbloqueado"
            : "Dispositivo bloqueado",
        });
      } catch {
        toast({
          title: "No se pudo actualizar el dispositivo",
          variant: "destructive",
        });
      } finally {
        setPendingLoanId(null);
      }
    },
    [lock, unlock, queryClient, toast],
  );

  return {
    toggleLock,
    pendingLoanId,
    isPending: (loanId: number) => pendingLoanId === loanId,
  };
}
