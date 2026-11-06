import { useState } from "react";
import { Link } from "wouter";
import { useListClients, ListClientsStatus } from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { StatusBadge } from "@/components/StatusBadge";
import {
  UserPlus,
  Phone,
  Mail,
  MapPin,
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

type LinkedCustomerDevice = {
  id: number;
  manufacturer: string | null;
  model: string;
  osVersion: string | null;
  deviceAdminActive: boolean;
  deviceOwner: boolean;
  latitude: number | null;
  longitude: number | null;
  lastSeenAt: string;
};

export default function Clients() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<ListClientsStatus | "all">("all");

  const { data: clients, isLoading } = useListClients(
    {
      search: debouncedSearch || undefined,
      status: status === "all" ? undefined : status,
    },
    {
      query: { refetchInterval: 5000 },
    },
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Clientes"
        description="Gestiona los clientes, sus celulares vinculados por APK y sus préstamos activos."
        action={
          <Link href="/clients/new">
            <Button className="w-full sm:w-auto shadow-sm gap-2">
              <UserPlus className="w-4 h-4" />
              Nuevo Cliente
            </Button>
          </Link>
        }
      />

      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, teléfono..."
              className="md:max-w-sm"
            />
            <div className="w-full md:w-48">
              <Select
                value={status}
                onValueChange={(val) =>
                  setStatus(val as ListClientsStatus | "all")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado del préstamo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="due_soon">Próximos a vencer</SelectItem>
                  <SelectItem value="overdue">Atrasados</SelectItem>
                  <SelectItem value="locked">Bloqueados</SelectItem>
                  <SelectItem value="completed">Completados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Celular Vinculado (APK)</TableHead>
                  <TableHead>Préstamo Actual</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Cargando clientes...
                    </TableCell>
                  </TableRow>
                ) : clients?.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No se encontraron clientes
                    </TableCell>
                  </TableRow>
                ) : (
                  clients?.map((client) => {
                    const device =
                      (
                        client as unknown as {
                          device?: LinkedCustomerDevice | null;
                        }
                      ).device ?? null;
                    const deviceName = device
                      ? [device.manufacturer, device.model]
                          .filter(Boolean)
                          .join(" ")
                      : null;

                    return (
                      <TableRow
                        key={client.id}
                        className="group hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-medium text-foreground">
                          <div>{client.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Desde {formatDate(client.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="w-3.5 h-3.5" /> {client.phone}
                            </span>
                            {client.email && (
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Mail className="w-3.5 h-3.5" /> {client.email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {device ? (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                                <Smartphone className="w-3.5 h-3.5 text-primary" />
                                {deviceName}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                                  <ShieldCheck className="w-3 h-3" />
                                  {device.deviceOwner
                                    ? "Device Owner"
                                    : device.deviceAdminActive
                                      ? "Admin Activo"
                                      : "Conectado"}
                                </span>
                                {device.latitude != null &&
                                  device.longitude != null && (
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${device.latitude},${device.longitude}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary hover:underline"
                                    >
                                      <MapPin className="w-3 h-3" /> Ver GPS ↗
                                    </a>
                                  )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Pendiente de enlazar
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.loan ? (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="text-sm font-medium">
                                {deviceName || client.loan.deviceModel}
                              </span>
                              <StatusBadge status={client.loan.status} />
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">
                              Sin préstamo activo
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/clients/${client.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-medium text-primary hover:text-primary hover:bg-primary/10"
                            >
                              Ver detalles
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
