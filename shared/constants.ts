/** Constantes sem dependências (podem ir para o bundle público sem carregar o zod). */
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const EVENT_TYPES = [
  "Bar ou casa de shows",
  "Festival",
  "Evento corporativo",
  "Casamento",
  "Aniversário ou festa particular",
  "Formatura",
  "Outro",
] as const;
