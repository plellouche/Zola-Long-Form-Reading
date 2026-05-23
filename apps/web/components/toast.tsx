'use client';

import { CheckCircle2, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

type ToastKind = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  show: (message: string, opts?: { kind?: ToastKind; durationMs?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 2200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback<ToastContextValue['show']>((message, opts) => {
    const id = Date.now() + Math.random();
    const kind = opts?.kind ?? 'success';
    const durationMs = opts?.durationMs ?? DEFAULT_DURATION_MS;
    setToasts((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={(id) =>
        setToasts((c) => c.filter((t) => t.id !== id))
      } />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail-soft: outside of a provider, toasts become no-ops rather than crash.
    return { show: () => undefined };
  }
  return ctx;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next tick.
    const handle = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(handle);
  }, []);

  const accent =
    toast.kind === 'error'
      ? 'border-red-300 text-red-700'
      : toast.kind === 'info'
        ? 'border-[hsl(var(--border))] text-[hsl(var(--foreground))]'
        : 'border-[hsl(var(--accent))]/40 text-[hsl(var(--foreground))]';

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-3 rounded-lg border bg-[hsl(var(--background))] px-4 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-200 ease-out ${accent} ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      {toast.kind === 'success' && (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--accent))]" />
      )}
      <span className="flex-1 text-sm">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
