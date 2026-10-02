import { Link } from "react-router-dom";
import { ErrorState } from "../components/States";
import type { ApiError } from "../lib/api";

/** Erros do painel: sessão expirada leva ao login; demais mostram mensagem e "tentar novamente". */
export function AdminError({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  if (error.status === 401) {
    return (
      <div role="alert" className="surface flex flex-col items-start gap-4 p-6">
        <p>Sua sessão expirou. Entre novamente para continuar.</p>
        <Link to="/admin/login" className="btn btn-primary btn-sm">
          Entrar novamente
        </Link>
      </div>
    );
  }
  if (error.status === 403) return <ErrorState message="Você não tem permissão para acessar esta área." />;
  if (error.status === 404) return <ErrorState message="Registro não encontrado. Ele pode ter sido excluído." />;
  return <ErrorState message={error.message} onRetry={onRetry} />;
}
