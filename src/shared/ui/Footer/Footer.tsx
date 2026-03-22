interface FooterProps {
  onCopy: () => void;
  onExecute: () => void;
}

export function Footer({ onCopy, onExecute }: FooterProps) {
  return (
    <footer className="flex justify-end items-center px-6 py-4 gap-4 bg-surface-container-lowest border-t border-outline-variant/20 shrink-0">
      <button
        onClick={onCopy}
        className="text-on-surface-variant px-6 py-2 font-semibold text-xs uppercase tracking-[0.1em] hover:text-on-surface transition-colors cursor-pointer"
      >
        📋 Copy
      </button>
      <button
        onClick={onExecute}
        className="bg-gradient-to-r from-primary-container to-primary text-background rounded-lg px-8 py-2.5 font-semibold text-xs uppercase tracking-[0.1em] shadow-[0_0_15px_rgba(145,126,255,0.3)] hover:brightness-110 transition-all"
      >
        🐱‍🏍 Get
      </button>
    </footer>
  );
}