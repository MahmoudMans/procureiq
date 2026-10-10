import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  /** id of the control inside; the error element gets `${htmlFor}-error`. */
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}

/** Label + control + inline error/hint, for forms and dialogs. */
export function Field({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  wide = false,
  children,
}: FieldProps) {
  return (
    <div className={`kit-field${wide ? " kit-field--wide" : ""}`}>
      <label className="kit-field__label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="kit-field__required" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>

      {children}

      {error ? (
        <span id={`${htmlFor}-error`} className="kit-field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="kit-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}
