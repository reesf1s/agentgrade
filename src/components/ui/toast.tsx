"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  error: (message: string) => void;
  success: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  error: () => {},
  success: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const error = useCallback((message: string) => toast(message, "error"), [toast]);
  const success = useCallback((message: string) => toast(message, "success"), [toast]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, error, success }}>
      {children}
      {/* Toast container — bottom-right */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon =
            t.type === "success"
              ? CheckCircle2
              : t.type === "error"
              ? AlertCircle
              : Info;
          return (
            <div
              key={t.id}
              className={cn(
                "glass-elevated px-4 py-3 flex items-start gap-3 min-w-[280px] max-w-[380px] pointer-events-auto"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 mt-0.5 flex-shrink-0",
                  t.type === "success"
                    ? "score-good"
                    : t.type === "error"
                    ? "score-critical"
                    : "text-fg-secondary"
                )}
              />
              <p className="text-sm text-fg flex-1 leading-snug">
                {t.message}
              </p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-fg-muted hover:text-fg transition-colors mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
