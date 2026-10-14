import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  let colorClass = "bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-200";
  let label = status;

  switch (status) {
    case 'active':
      colorClass = "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200";
      label = "Activo";
      break;
    case 'due_soon':
      colorClass = "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200";
      label = "Próximo a vencer";
      break;
    case 'overdue':
      colorClass = "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200";
      label = "Atrasado";
      break;
    case 'locked':
      colorClass = "bg-red-50 text-red-700 hover:bg-red-100 border-red-200";
      label = "Bloqueado";
      break;
    case 'completed':
      colorClass = "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200";
      label = "Completado";
      break;
    case 'pending':
      colorClass = "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200";
      label = "Pendiente";
      break;
    case 'failed':
      colorClass = "bg-red-50 text-red-700 hover:bg-red-100 border-red-200";
      label = "Fallido";
      break;
  }

  return (
    <Badge variant="outline" className={`font-medium shadow-none ${colorClass}`}>
      {label}
    </Badge>
  );
}
