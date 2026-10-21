import type { Ionicons } from "@expo/vector-icons";
import type { PaymentMethod } from "@/context/LoanContext";

export function formatCurrency(amount: number): string {
  return "$" + amount.toLocaleString("es-MX", { minimumFractionDigits: 2 });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const PAYMENT_METHOD_META: Record<
  PaymentMethod,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    outlineIcon: keyof typeof Ionicons.glyphMap;
  }
> = {
  transfer: {
    label: "Transferencia",
    icon: "swap-horizontal",
    outlineIcon: "swap-horizontal-outline",
  },
  cash: {
    label: "Efectivo",
    icon: "cash",
    outlineIcon: "cash-outline",
  },
  card: {
    label: "Tarjeta",
    icon: "card",
    outlineIcon: "card-outline",
  },
};
