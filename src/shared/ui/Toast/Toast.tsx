import type { ToastData } from "@/shared/lib/toast";

const STYLES: Record<NonNullable<ToastData["type"]>, string> = {
  success: "border-tertiary/30 text-tertiary",
  error:   "border-error/30 text-error",
  info:    "border-primary/30 text-primary",
};

const ICONS: Record<NonNullable<ToastData["type"]>, string> = {
  success: "✓",
  error:   "✕",
  info:    "i",
};

export function Toast({ message, type = "success" }: Omit<ToastData, "id">) {
  return (
    <div
      className={[
        "flex items-center gap-3 px-4 py-3 rounded-lg",
        "bg-surface-container border backdrop-blur-sm",
        "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        "animate-[fadeInUp_0.2s_ease-out]",
        STYLES[type],
      ].join(" ")}
    >
      <span className="text-xs font-bold w-4 h-4 rounded-full border border-current flex items-center justify-center shrink-0">
        {ICONS[type]}
      </span>
      <span className="text-xs font-medium text-on-surface">{message}</span>
    </div>
  );
}