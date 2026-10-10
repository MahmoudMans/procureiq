"use client";

/**
 * Promise-based confirmation dialog.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Cancel this request?", tone: "danger", confirmLabel: "Cancel request" })) { ... }
 *
 * Add `requireText: "DELETE"` to make the user type a phrase before the button unlocks.
 */
import { CircleHelp, TriangleAlert } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

import { Modal } from "./modal";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  requireText?: string;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingRequest {
  id: number;
  options: ConfirmOptions;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const resolver = useRef<((result: boolean) => void) | null>(null);
  const counter = useRef(0);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        // A second confirm() while one is open cancels the first.
        resolver.current?.(false);
        resolver.current = resolve;
        counter.current += 1;
        setRequest({ id: counter.current, options });
      }),
    [],
  );

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setRequest(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {request ? (
        <ConfirmDialog key={request.id} options={request.options} onSettle={settle} />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);

  if (!confirm) {
    throw new Error("useConfirm must be used inside <UiProvider>.");
  }

  return confirm;
}

function ConfirmDialog({
  options,
  onSettle,
}: {
  options: ConfirmOptions;
  onSettle: (result: boolean) => void;
}) {
  const [typed, setTyped] = useState("");

  const danger = options.tone === "danger";
  const Icon = danger ? TriangleAlert : CircleHelp;
  const locked =
    options.requireText !== undefined &&
    typed.trim().toLowerCase() !== options.requireText.trim().toLowerCase();

  return (
    <Modal
      title={options.title}
      size="sm"
      onClose={() => onSettle(false)}
      footer={
        <>
          <button
            type="button"
            className="button button--secondary"
            data-autofocus={danger ? "" : undefined}
            onClick={() => onSettle(false)}
          >
            {options.cancelLabel ?? "Cancel"}
          </button>

          <button
            type="button"
            className={`button ${danger ? "kit-btn-danger" : "button--primary"}`}
            data-autofocus={danger ? undefined : ""}
            disabled={locked}
            onClick={() => onSettle(true)}
          >
            {options.confirmLabel ?? "Confirm"}
          </button>
        </>
      }
    >
      <div className="kit-confirm">
        <div className={`kit-confirm__icon${danger ? " is-danger" : ""}`}>
          <Icon size={20} aria-hidden="true" />
        </div>

        <div className="kit-confirm__text">
          {options.description ? <div>{options.description}</div> : null}

          {options.requireText !== undefined ? (
            <label className="kit-confirm__type">
              <span>
                Type <strong>{options.requireText}</strong> to continue
              </span>

              <input
                className="kit-input"
                value={typed}
                autoComplete="off"
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !locked) {
                    event.preventDefault();
                    onSettle(true);
                  }
                }}
              />
            </label>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
