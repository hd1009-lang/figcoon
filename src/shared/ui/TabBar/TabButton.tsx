interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export function TabButton({ label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-[0.45rem] -mb-px bg-none border-b-2 text-xs font-sans whitespace-nowrap transition-colors duration-200 cursor-pointer",
        isActive
          ? "text-primary border-[#7B61FF]"
          : "text-on-surface-variant border-transparent hover:text-on-surface",
      ].join(" ")}
    >
      {label}
    </button>
  );
}