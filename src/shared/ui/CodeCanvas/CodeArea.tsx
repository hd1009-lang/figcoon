interface CodeAreaProps {
  content: string;
}

export function CodeArea({ content }: CodeAreaProps) {
  return (
    <div className="flex-1 p-4 relative">
      <textarea id="content-area" className="text-on-surface-variant text-sm leading-7 font-mono text-[12px] w-full h-full resize-none outline-none" readOnly value={content}>
      </textarea>
      <div className="w-1 h-5 bg-primary opacity-60 absolute top-[270px] left-[150px] animate-blink" />
    </div>
  );
}