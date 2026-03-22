import { useCssLayout } from "@/features/css-styles/model/useCssLayout";
import { CodeCanvas } from "@/shared/ui/CodeCanvas";

export function CssLayout() {
  const { content, loading, error } = useCssLayout();

  if (loading) return <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm">Loading...</div>;
  if (error)   return <div className="flex-1 flex items-center justify-center text-error text-sm">{error}</div>;

  return <CodeCanvas content={content!.replace(/\\n/g, '\n')} />;
}