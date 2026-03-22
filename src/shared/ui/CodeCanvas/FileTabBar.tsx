interface FileTabBarProps {
  fileName: string;
}

export function FileTabBar({ fileName }: FileTabBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-[0.4rem] bg-surface-container-low border-b border-outline-variant/10">
      <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-on-surface-variant">
        {fileName}
      </span>
      <div className="flex gap-2 items-center">
        <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_#ffb59f]" />
        <span className="w-2 h-2 rounded-full bg-tertiary" />
      </div>
    </div>
  );
}