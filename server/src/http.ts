import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { fieldErrors } from "../../shared/schemas";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Registro") => new HttpError(404, `${what} não encontrado.`);

/** Envolve handlers async para que erros cheguem ao middleware de erro. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** Valida o corpo com zod; lança 422 com erros por campo. */
export function parse<S extends ZodType>(schema: S, data: unknown) {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(422, "Revise os campos destacados.", fieldErrors(r.error));
  return r.data as import("zod").output<S>;
}

export function intParam(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw notFound();
  return n;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, fields: err.fields });
    return;
  }
  // multer / body-parser
  const e = err as { code?: string; type?: string; status?: number };
  if (e?.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "Arquivo muito grande." });
    return;
  }
  if (e?.type === "entity.too.large") {
    res.status(413).json({ error: "Requisição muito grande." });
    return;
  }
  if (e?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Requisição inválida." });
    return;
  }
  // Log sem dados pessoais: apenas método, rota e erro.
  console.error(`[erro] ${req.method} ${req.path}`, err instanceof Error ? err.stack : err);
  res.status(500).json({ error: "Erro interno. Tente novamente em instantes." });
}

/** Limitador de requisições em memória (janela fixa). Suficiente para uma instância. */
export function rateLimit(opts: {
  windowMs: number;
  max: number;
  key: (req: Request) => string;
  message: string;
  /** conta apenas respostas com erro (ex.: tentativas de login malsucedidas) */
  onlyFailures?: boolean;
}) {
  const hits = new Map<string, { count: number; reset: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, Math.min(opts.windowMs, 60_000)).unref();

  const limiter: RequestHandler & { reset: () => void } = Object.assign(
    (req: Request, res: Response, next: NextFunction) => {
      const k = opts.key(req);
      const now = Date.now();
      let h = hits.get(k);
      if (!h || h.reset <= now) {
        h = { count: 0, reset: now + opts.windowMs };
        hits.set(k, h);
      }
      h.count++;
      if (h.count > opts.max) {
        res.setHeader("Retry-After", Math.ceil((h.reset - now) / 1000));
        res.status(429).json({ error: opts.message });
        return;
      }
      if (opts.onlyFailures) {
        const entry = h;
        res.on("finish", () => {
          if (res.statusCode < 400 && entry.count > 0) entry.count--;
        });
      }
      next();
    },
    { reset: () => hits.clear() },
  );
  return limiter;
}
