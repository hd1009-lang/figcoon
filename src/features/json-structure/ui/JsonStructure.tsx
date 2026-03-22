import { CodeCanvas } from "@/shared/ui/CodeCanvas";
import { useJsonStructure } from "../model/useJsonStructure";

export function JsonStructure() {
  const { content, loading, error } = useJsonStructure();

  if (loading) return <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm">Loading...</div>;
  if (error)   return <div className="flex-1 flex items-center justify-center text-error text-sm">{error}</div>;

  return <CodeCanvas content={content!} />;
}