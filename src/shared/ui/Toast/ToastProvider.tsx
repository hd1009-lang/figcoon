import type { ToastData } from "@/shared/lib/toast";
import { Toast } from "./Toast";

interface ToastProviderProps {
  toasts: ToastData[];
}

export function ToastProvider({ toasts }: ToastProviderProps) {
  if (!toasts.length) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} />
      ))}
    </div>
  );
}