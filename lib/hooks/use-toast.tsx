"use client";

/**
 * lib/hooks/use-toast.tsx
 * -----------------------------------------------------------------------
 * Minimal, dependency-free toast notification system. Wrap the app (or a
 * page) in <ToastProvider>, then call `useToast().push(...)` from any
 * client component underneath it to surface a create/edit/publish result.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: React.ReactNode; text: string }> = {
  success: {
    border: "border-emerald-500/40",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    text: "text-emerald-300",
  },
  error: {
    border: "border-red-500/40",
    icon: <XCircle className="w-4 h-4 text-red-400" />,
    text: "text-red-300",
  },
  info: {
    border: "border-blue-500/40",
    icon: <Info className="w-4 h-4 text-blue-400" />,
    text: "text-blue-300",
  },
};

function Toaster({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const style = VARIANT_STYLES[toast.variant];
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 bg-slate-900/95 border ${style.border} rounded-2xl p-4 shadow-2xl backdrop-blur-xl`}
          >
            <div className="mt-0.5">{style.icon}</div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold font-mono ${style.text}`}>{toast.title}</p>
              {toast.description && <p className="text-xs text-slate-400 mt-0.5">{toast.description}</p>}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-slate-500 hover:text-white transition"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      if (typeof window !== "undefined") {
        window.setTimeout(() => dismiss(id), 5000);
      }
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
