import { getCssStructure } from "@/features/css-styles-structure/api/getCssStructure";
import { COMMAND } from "@/shared/lib/figma/command";
import { useState, useEffect } from "react";

interface State {
  content: string | null;
  loading: boolean;
  error: string | null;
}

export function useCssStructure() {
  const [state, setState] = useState<State>({
    content: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    getCssStructure();
    window.onmessage = (event) => {
      const message = event.data.pluginMessage;
      if (message.type === COMMAND.receive_result) {
        setState({ content: message.data, loading: false, error: null });
      }
    };
  }, []);

  return state;
}
