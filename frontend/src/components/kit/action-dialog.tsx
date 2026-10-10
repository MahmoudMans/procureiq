"use client";

import type { ReactNode } from "react";

import { Modal } from "@/components/kit";

interface ActionDialogProps {
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

/** Small confirmation dialog for workflow actions (publish, close, cancel...). */
export function ActionDialog({
  eyebrow,
  title,
  description,
  confirmLabel,
  busyLabel = "Working…",
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
  children,
}: ActionDialogProps) {
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
            type="button"
            className={
              tone === "danger"
                ? "button button--primary kit-button-danger"
                : "button button--primary"
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
