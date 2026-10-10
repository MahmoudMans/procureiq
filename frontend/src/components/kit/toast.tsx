"use client";

/**
 * Toasts
 *
 *   const toast = useToast();
 *   toast.success("Supplier created", "Acme Ltd was added.");
 *   toast.error("Could not save", error.message);
 *
 * Errors stay longer, hovering a toast pauses its timer, at most 4 are shown at once.
 */
import {
  CircleAlert,
  CircleCheckBig,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before it disappears. 0 keeps it until closed. */
  durationMs?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  durationMs: number;
  action?: ToastOptions["action"];
}

export interface ToastApi {
  show: (options: ToastOptions) => number;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  warning: (title: string, description?: string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAX_TOASTS = 4;

const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 4500,
  warning: 6000,
  error: 7000,
};

const ICONS: Record<ToastTone, LucideIcon> = {
  success: CircleCheckBig,
  error: CircleAlert,
  info: Info,
  warning: TriangleAlert,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const clearTimer = useCallback((id: number) => {
    const handle = timers.current.get(id);

    if (handle !== undefined) {
      window.clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      setToasts((current) => current.filter((item) => item.id !== id));
    },
    [clearTimer],
  );

  const arm = useCallback(
    (id: number, milliseconds: number) => {
      clearTimer(id);

      if (milliseconds > 0) {
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), milliseconds),
        );
      }
    },
    [clearTimer, dismiss],
  );

  const show = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      const tone = options.tone ?? "info";
      const durationMs = options.durationMs ?? DEFAULT_DURATION[tone];

      setToasts((current) =>
        [
          ...current,
          {
            id,
            title: options.title,
            description: options.description,
            tone,
            durationMs,
            action: options.action,
          },
        ].slice(-MAX_TOASTS),
      );

      arm(id, durationMs);

      return id;
    },
    [arm],
  );

  useEffect(() => {
    const active = timers.current;

    return () => {
      active.forEach((handle) => window.clearTimeout(handle));
      active.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ title, description, tone: "success" }),
      error: (title, description) => show({ title, description, tone: "error" }),
      info: (title, description) => show({ title, description, tone: "info" }),
      warning: (title, description) => show({ title, description, tone: "warning" }),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="kit-toast-region" role="region" aria-label="Notifications">
        {toasts.map((item) => {
          const Icon = ICONS[item.tone];

          return (
            <div
              key={item.id}
              className={`kit-toast kit-toast--${item.tone}`}
              role={item.tone === "error" ? "alert" : "status"}
              onMouseEnter={() => clearTimer(item.id)}
              onMouseLeave={() => {
                if (item.durationMs > 0) {
                  arm(item.id, Math.min(item.durationMs, 2500));
                }
              }}
            >
              <Icon size={18} className="kit-toast__icon" aria-hidden="true" />

              <div className="kit-toast__body">
                <strong>{item.title}</strong>

                {item.description ? <span>{item.description}</span> : null}
              </div>

              {item.action ? (
                <button
                  type="button"
                  className="kit-toast__action"
                  onClick={() => {
                    item.action?.onClick();
                    dismiss(item.id);
                  }}
                >
                  {item.action.label}
                </button>
              ) : null}

              <button
                type="button"
                className="kit-toast__close"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);

  if (!api) {
    throw new Error("useToast must be used inside <UiProvider>.");
  }

  return api;
}
