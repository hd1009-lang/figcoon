import { CodeCanvas } from "@/shared/ui/CodeCanvas";
import { useVariables } from "../model/useVariables";

export function Variables() {
  const { content, loading, error } = useVariables();

  if (loading) return <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm">Loading...</div>;
  if (error)   return <div className="flex-1 flex items-center justify-center text-error text-sm">{error}</div>;

  return <CodeCanvas content={content!} />;
}