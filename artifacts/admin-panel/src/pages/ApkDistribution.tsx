import { ChangeEvent, useEffect, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Clock3,
  Download,
  FileArchive,
  Loader2,
  Smartphone,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type ApkVersion = {
  id: number;
  version: string;
  fileName: string;
  objectPath: string;
  size: number;
  contentType: string;
  checksum: string;
  status: "pending" | "active" | "archived";
  createdAt: string;
  publishedAt: string | null;
};
type ApkMeta = { available: boolean; current: ApkVersion | null; versions: ApkVersion[] };
const apiBase = "/api/admin/apk";
function formatSize(bytes: number) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("es-MX") : "—";
}

export default function ApkDistribution() {
  const [meta, setMeta] = useState<ApkMeta | null>(null);
  const [version, setVersion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const { toast } = useToast();

  async function load() {
    const response = await fetch(apiBase);
    if (response.ok) setMeta(await response.json());
  }

  useEffect(() => {
    void load();
  }, []);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.name.toLowerCase().endsWith(".apk")) {
      toast({ title: "Archivo inválido", description: "Selecciona una APK de Android.", variant: "destructive" });
      return;
    }
    if (!version.trim()) {
      toast({ title: "Indica la versión", description: "Ejemplo: 1.4.0 o 2026.09.01.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const contentType = file.type || "application/vnd.android.package-archive";
      const prepare = await fetch(`${apiBase}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size, contentType, version: version.trim() }),
      });
      const prepareBody = await prepare.json();
      if (!prepare.ok) throw new Error(prepareBody.error || "No se pudo preparar la subida");

      const uploadResponse = await fetch(prepareBody.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("No se pudo guardar la APK en App Storage");

      const finalize = await fetch(`${apiBase}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          size: file.size,
          contentType,
          version: version.trim(),
          objectPath: prepareBody.objectPath,
        }),
      });
      const finalizeBody = await finalize.json();
      if (!finalize.ok) throw new Error(finalizeBody.error || "La APK no pasó la validación");

      await load();
      setVersion("");
      toast({ title: "APK validada", description: "La versión quedó pendiente de activación." });
    } catch (error) {
      toast({
        title: "No se pudo subir la APK",
        description: error instanceof Error ? error.message : "Comprueba que el servidor esté disponible.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function activate(id: number) {
    setActivatingId(id);
    try {
      const response = await fetch(`${apiBase}/versions/${id}/activate`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo activar la versión");
      setMeta(body);
      toast({ title: "Versión activa", description: "El enlace estable ya entrega esta APK." });
    } catch (error) {
      toast({
        title: "No se pudo activar",
        description: error instanceof Error ? error.message : "Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setActivatingId(null);
    }
  }

  const current = meta?.current;
  const pending = meta?.versions.filter((item) => item.status === "pending") ?? [];

  return <div className="max-w-5xl space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Distribución APK</h1>
      <p className="mt-1 text-muted-foreground">Administra versiones verificadas de FinJoy y conserva la versión activa anterior mientras revisas una nueva.</p>
    </div>

    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
      <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Smartphone className="h-8 w-8" /></div>
        <div className="flex-1">
          <h2 className="text-xl font-bold">Instalador de FinJoy</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enlace estable para clientes: conserva siempre la última versión activada.</p>
          {current && <p className="mt-2 text-sm font-medium">Versión activa {current.version} · {formatSize(current.size)}</p>}
        </div>
        {current && <a href={`${apiBase}/download`} download><Button className="gap-2"><Download className="h-4 w-4" /> Descargar activa</Button></a>}
      </CardContent>
    </Card>

    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Subir una versión</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label htmlFor="apk-version">Versión</Label><Input id="apk-version" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.4.0" disabled={uploading} /></div>
          <p className="text-sm text-muted-foreground">La APK se valida por extensión, MIME, tamaño y firma ZIP antes de aparecer como pendiente.</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-8 text-center transition hover:border-primary hover:bg-primary/10">
            {uploading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <FileArchive className="h-7 w-7 text-primary" />}
            <span className="text-sm font-semibold">{uploading ? "Subiendo y validando..." : "Seleccionar archivo APK"}</span>
            <span className="text-xs text-muted-foreground">Hasta 100 MB · quedará pendiente hasta activarla</span>
            <input type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" onChange={upload} disabled={uploading} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Estado de publicación</CardTitle></CardHeader>
        <CardContent>
          {current ? <div className="space-y-4">
            <div className="rounded-xl bg-emerald-500/10 p-4"><p className="font-semibold text-emerald-700">APK activa</p><p className="mt-1 text-sm text-muted-foreground">{current.fileName} · {formatSize(current.size)}</p></div>
            <div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted-foreground">Versión</span><p className="font-semibold">{current.version}</p></div><div><span className="text-muted-foreground">Activada</span><p className="font-semibold">{formatDate(current.publishedAt)}</p></div></div>
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Al instalarla, Android solicitará activar FinJoy como Administrador del dispositivo para proteger el crédito.</div>
          </div> : <div className="py-6 text-center"><FileArchive className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">No hay una APK activa</p><p className="mt-1 text-sm text-muted-foreground">Sube y activa una versión para habilitar la descarga.</p></div>}
        </CardContent>
      </Card>
    </div>

    {pending.length > 0 && <Card className="border-amber-500/30">
      <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-amber-600" /> Pendientes de activación</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {pending.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center">
          <div className="flex-1"><div className="flex items-center gap-2"><span className="font-semibold">v{item.version}</span><Badge variant="outline" className="border-amber-500/40 text-amber-700">Pendiente</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.fileName} · {formatSize(item.size)} · subida {formatDate(item.createdAt)}</p></div>
          <Button onClick={() => activate(item.id)} disabled={activatingId !== null} className="gap-2">{activatingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Activar versión</Button>
        </div>)}
      </CardContent>
    </Card>}

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5 text-muted-foreground" /> Historial de versiones</CardTitle></CardHeader>
      <CardContent>
        {meta?.versions.length ? <div className="divide-y">{meta.versions.map((item) => <div key={item.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
          <div className="flex-1"><div className="flex items-center gap-2"><span className="font-semibold">v{item.version}</span><Badge variant="outline" className={item.status === "active" ? "border-emerald-500/40 text-emerald-700" : item.status === "pending" ? "border-amber-500/40 text-amber-700" : "text-muted-foreground"}>{item.status === "active" ? "Activa" : item.status === "pending" ? "Pendiente" : "Archivada"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.fileName} · {formatSize(item.size)} · {formatDate(item.createdAt)}</p></div>
          <span className="font-mono text-xs text-muted-foreground" title={item.checksum}>SHA-256 {item.checksum.slice(0, 12)}…</span>
        </div>)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay versiones registradas.</p>}
      </CardContent>
    </Card>

    <Card><CardHeader><CardTitle>Cómo generar la APK en tu PC</CardTitle></CardHeader><CardContent><ol className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3"><li><b className="block text-foreground">1. Prepara el equipo</b>Instala Node.js LTS y Android Studio con Android SDK Platform 36.</li><li><b className="block text-foreground">2. Compila</b>Al descargar el proyecto, abre <code className="rounded bg-muted px-1.5 py-0.5 text-xs">GENERAR_APK_WINDOWS.bat</code>.</li><li><b className="block text-foreground">3. Publica</b>Sube <code className="rounded bg-muted px-1.5 py-0.5 text-xs">generated-apk/FinJoy-debug.apk</code>, revisa la versión y actívala.</li></ol></CardContent></Card>
  </div>;
}