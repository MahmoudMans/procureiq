"use client";

import { CircleAlert } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";

import { Field, Modal } from "@/components/kit";

interface RationaleDialogProps {
  eyebrow: string;
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  error?: string | null;
  maxLength?: number;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  children?: ReactNode;
}

/** Workflow dialog that needs a written rationale (holds, cancellations, exceptions...). */
export function RationaleDialog({
  eyebrow,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  busyLabel = "Saving…",
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  error = null,
  maxLength = 2000,
  onConfirm,
  onCancel,
  children,
}: RationaleDialogProps) {
  const formId = useId();
  const fieldId = `${formId}-reason`;

  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  const missing = reason.trim() === "";
  const fieldError = touched && missing ? "This field is required." : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) {
      return;
    }

    if (missing) {
      setTouched(true);

      return;
    }

    onConfirm(reason.trim());
  }

  return (
    <Modal
      eyebrow={eyebrow}
      title={title}
      description={description}
      size="md"
      dismissible={!busy}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>

          <button
            type="submit"
            form={formId}
            className={
              tone === "danger"
                ? "button button--primary kit-button-danger"
                : "button button--primary"
            }
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </>
      }
    >
      {children}

      <form id={formId} onSubmit={handleSubmit} noValidate>
        <Field label={label} htmlFor={fieldId} error={fieldError}>
          <textarea
            id={fieldId}
            className="kit-field-input"
            rows={4}
            maxLength={maxLength}
            value={reason}
            placeholder={placeholder}
            aria-invalid={fieldError ? true : undefined}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>

        <div className="kit-char-count">
          {reason.length} / {maxLength}
        </div>

        {error ? (
          <div className="error-banner" role="alert" style={{ marginTop: 12 }}>
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
