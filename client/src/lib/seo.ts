import { useEffect } from "react";

/** Atualiza título e descrição durante a navegação no cliente (o servidor já entrega os metadados na primeira carga). */
export function useSeo(title: string | undefined, description?: string) {
  useEffect(() => {
    if (!title) return;
    document.title = title;
    if (description) {
      let m = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!m) {
        m = document.createElement("meta");
        m.name = "description";
        document.head.appendChild(m);
      }
      m.content = description;
    }
  }, [title, description]);
}
