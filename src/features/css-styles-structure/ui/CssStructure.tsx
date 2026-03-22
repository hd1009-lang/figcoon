
import { useCssStructure } from "@/features/css-styles-structure/model/useCssStructure";
import { CodeCanvas } from "@/shared/ui/CodeCanvas";

export function CssStructure() {
  const { content, loading, error } = useCssStructure();

  if (loading) return <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm">Loading...</div>;
  if (error)   return <div className="flex-1 flex items-center justify-center text-error text-sm">{error}</div>;

  return <CodeCanvas content={content!} />;
}