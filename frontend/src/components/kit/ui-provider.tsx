"use client";

import type { ReactNode } from "react";

import { ConfirmProvider } from "./confirm";
import { ToastProvider } from "./toast";

/** Mounts toasts and confirm dialogs once, for every page inside the app shell. */
export function UiProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
