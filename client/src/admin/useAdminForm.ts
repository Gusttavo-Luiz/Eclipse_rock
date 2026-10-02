import { useState } from "react";
import type { ZodType } from "zod";
import { fieldErrors } from "../../../shared/schemas";
import { useToast } from "../components/Toast";
import { ApiError } from "../lib/api";

/**
 * Estado de formulário administrativo: valida com o mesmo schema do backend antes de enviar,
 * mostra erros por campo (do cliente ou do servidor) e evita envios duplicados.
 */
export function useAdminForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const set = <K extends keyof T>(k: K, v: T[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => (e[k as string] ? { ...e, [k as string]: "" } : e));
  };

  async function submit<R>(schema: ZodType | null, action: (v: T) => Promise<R>, successMsg?: string): Promise<R | undefined> {
    if (saving) return;
    if (schema) {
      const r = schema.safeParse(values);
      if (!r.success) {
        setErrors(fieldErrors(r.error));
        toast("Revise os campos destacados.", "error");
        return;
      }
    }
    setSaving(true);
    try {
      const result = await action(values);
      setErrors({});
      if (successMsg) toast(successMsg);
      return result;
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.fields) setErrors(e.fields);
        toast(e.message, "error");
      } else toast("Erro inesperado.", "error");
    } finally {
      setSaving(false);
    }
  }

  return { values, setValues, set, errors, saving, submit };
}
