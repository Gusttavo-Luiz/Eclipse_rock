import type { ApiErrorBody } from "../../../shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

const DEFAULT_ERROR = "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

/** Wrapper de fetch: JSON, cookies de sessão, cabeçalho anti-CSRF e erros tipados. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  // Versão de demonstração estática: sem servidor. O bloco some do bundle normal.
  if (import.meta.env.VITE_DEMO === "1") return (await import("../demo/mockApi")).demoApi<T>(path, init);
  const headers = new Headers(init.headers);
  headers.set("X-Requested-With", "eclipse-rock");
  headers.set("Accept", "application/json");
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, DEFAULT_ERROR);
  }
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      /* corpo inválido */
    }
  }
  if (!res.ok) {
    const e = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(res.status, e.error ?? (res.status >= 500 ? "Erro no servidor. Tente novamente." : DEFAULT_ERROR), e.fields);
  }
  return data as T;
}

export const apiGet = <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const apiSend = <T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, json?: unknown) =>
  api<T>(path, { method, json });

export async function uploadImage(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return api<import("../../../shared/types").ImageRef>("/api/admin/uploads", { method: "POST", body: fd });
}
