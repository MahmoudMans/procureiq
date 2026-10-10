"use client";

/**
 * Modal
 *   - rendered in a portal on <body>
 *   - focuses the first field (or [data-autofocus]) and gives focus back on close
 *   - traps Tab inside, closes on Escape / backdrop click (unless dismissible=false)
 *   - locks page scroll; several stacked modals are handled
 *
 * Render it conditionally: {open ? <Modal ...> : null}
 */
import { X } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  title: string;
  eyebrow?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  onClose: () => void;
  /** false = ignore Escape, backdrop clicks and the close button (e.g. while saving). */
  dismissible?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  title,
  eyebrow,
  description,
  size = "md",
  onClose,
  dismissible = true,
  children,
  footer,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;

    if (dialog) {
      const preferred =
        dialog.querySelector<HTMLElement>("[data-autofocus]") ??
        dialog.querySelector<HTMLElement>(
          'input:not([type="hidden"]), select, textarea',
        );

      (preferred ?? dialog).focus();
    }

    const locks = Number(document.body.dataset.kitLocks ?? "0") + 1;

    document.body.dataset.kitLocks = String(locks);
    document.body.style.overflow = "hidden";

    return () => {
      const remaining = Number(document.body.dataset.kitLocks ?? "1") - 1;

      if (remaining <= 0) {
        delete document.body.dataset.kitLocks;
        document.body.style.overflow = "";
      } else {
        document.body.dataset.kitLocks = String(remaining);
      }

      if (previous && previous.isConnected) {
        previous.focus();
      }
    };
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();

      if (dismissible) {
        onClose();
      }

      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const items = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((element) => element.offsetParent !== null);

    if (items.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="kit-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        className={`kit-modal kit-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="kit-modal__header">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}

            <h2 id={titleId}>{title}</h2>

            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>

          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            disabled={!dismissible}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="kit-modal__body">{children}</div>

        {footer ? <footer className="kit-modal__footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
