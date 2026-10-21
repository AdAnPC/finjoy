import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export type ApkVersion = {
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

export type ApkMeta = {
  available: boolean;
  current: ApkVersion | null;
  versions: ApkVersion[];
};

export type ProtectionConfig = {
  frpAccountIds: string[];
  organizationName: string;
};

export const APK_API_BASE = "/api/admin/apk";

export function useApkDistribution() {
  const [meta, setMeta] = useState<ApkMeta | null>(null);
  const [version, setVersion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [frpInput, setFrpInput] = useState("");
  const [organizationName, setOrganizationName] = useState("FinJoy Crédito Móvil");
  const [frpAccountIds, setFrpAccountIds] = useState<string[]>([]);
  const [savingProtection, setSavingProtection] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [apkRes, protRes] = await Promise.all([
      fetch(APK_API_BASE),
      fetch(`${APK_API_BASE}/protection-config`),
    ]);
    if (apkRes.ok) {
      setMeta(await apkRes.json());
    }
    if (protRes.ok) {
      const prot = (await protRes.json()) as ProtectionConfig;
      setFrpAccountIds(prot.frpAccountIds ?? []);
      setFrpInput((prot.frpAccountIds ?? []).join(", "));
      if (prot.organizationName) {
        setOrganizationName(prot.organizationName);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProtection = useCallback(async () => {
    setSavingProtection(true);
    try {
      const parsedIds = frpInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const response = await fetch(`${APK_API_BASE}/protection-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frpAccountIds: parsedIds,
          organizationName: organizationName.trim() || "FinJoy Crédito Móvil",
        }),
      });
      if (!response.ok) {
        throw new Error("No se pudo guardar la configuración anti-formateo");
      }
      const saved = (await response.json()) as ProtectionConfig;
      setFrpAccountIds(saved.frpAccountIds);
      setFrpInput(saved.frpAccountIds.join(", "));
      setOrganizationName(saved.organizationName);
      toast({
        title: "Blindaje FRP / Zero-Touch actualizado",
        description:
          "El código QR, el JSON de Zero-Touch y las APKs conectadas ya usan esta configuración.",
      });
    } catch (error) {
      toast({
        title: "Error al guardar",
        description:
          error instanceof Error ? error.message : "Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSavingProtection(false);
    }
  }, [frpInput, organizationName, toast]);

  const upload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".apk")) {
        toast({
          title: "Archivo inválido",
          description: "Selecciona una APK de Android.",
          variant: "destructive",
        });
        return;
      }
      if (!version.trim()) {
        toast({
          title: "Indica la versión",
          description: "Ejemplo: 1.4.0 o 2026.09.01.",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);
      try {
        const contentType =
          file.type || "application/vnd.android.package-archive";
        const prepare = await fetch(`${APK_API_BASE}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            size: file.size,
            contentType,
            version: version.trim(),
          }),
        });
        const prepareBody = await prepare.json();
        if (!prepare.ok) {
          throw new Error(prepareBody.error || "No se pudo preparar la subida");
        }

        const uploadResponse = await fetch(prepareBody.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!uploadResponse.ok) {
          throw new Error("No se pudo guardar la APK en el servidor");
        }

        const finalize = await fetch(`${APK_API_BASE}/versions`, {
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
        if (!finalize.ok) {
          throw new Error(finalizeBody.error || "La APK no pasó la validación");
        }

        await load();
        setVersion("");
        toast({
          title: "APK validada",
          description: "La versión quedó pendiente de activación.",
        });
      } catch (error) {
        toast({
          title: "No se pudo subir la APK",
          description:
            error instanceof Error
              ? error.message
              : "Comprueba que el servidor esté disponible.",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [load, toast, version],
  );

  const activate = useCallback(
    async (id: number) => {
      setActivatingId(id);
      try {
        const response = await fetch(
          `${APK_API_BASE}/versions/${id}/activate`,
          { method: "POST" },
        );
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "No se pudo activar la versión");
        }
        setMeta(body);
        toast({
          title: "Versión activa",
          description: "El enlace estable ya entrega esta APK.",
        });
      } catch (error) {
        toast({
          title: "No se pudo activar",
          description:
            error instanceof Error ? error.message : "Inténtalo de nuevo.",
          variant: "destructive",
        });
      } finally {
        setActivatingId(null);
      }
    },
    [toast],
  );

  const current = meta?.current ?? null;
  const versions = meta?.versions ?? [];
  const pending = versions.filter((item) => item.status === "pending");

  return {
    current,
    versions,
    pending,
    version,
    setVersion,
    uploading,
    activatingId,
    upload,
    activate,
    frpAccountIds,
    frpInput,
    setFrpInput,
    organizationName,
    setOrganizationName,
    savingProtection,
    saveProtection,
  };
}
