import { CodeArea } from "./CodeArea";

interface CodeCanvasProps {
  content: string;
}

export function CodeCanvas({ content }: CodeCanvasProps) {
  return (
    <div className="flex-1 flex flex-col bg-surface-container-lowest rounded-b-xl border border-outline-variant/10 border-t-0 overflow-hidden mt-2">
      <CodeArea content={content} />
    </div>
  );
}