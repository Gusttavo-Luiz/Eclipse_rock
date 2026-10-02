import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/**
 * Campo de formulário acessível: label associado, dica e erro ligados via aria-describedby,
 * aria-invalid quando há erro.
 */
export function Field({
  label,
  error,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
}) {
  const id = useId();
  const inputId = (children.props.id as string) ?? `f${id}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errId = error ? `${inputId}-err` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: inputId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [hintId, errId].filter(Boolean).join(" ") || undefined,
        "aria-required": required || undefined,
      })
    : children;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="field-label">
        {label}
        {required ? (
          <span className="text-magenta-soft" aria-hidden>
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-mist"> (opcional)</span>
        )}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
