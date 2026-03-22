import { getCssLayout } from "@/features/css-styles/api/getCssLayout";
import { COMMAND } from "@/shared/lib/figma/command";
import { useState, useEffect } from "react";

interface State {
  content: string | null;
  loading: boolean;
  error: string | null;
}

export function useCssLayout() {
  const [state, setState] = useState<State>({
    content: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    getCssLayout();
    window.onmessage = (event) => {
      const message = event.data.pluginMessage;
      if (message.type === COMMAND.receive_result) {
        setState({ content: message.data, loading: false, error: null });
      }
    };
  }, []);

  return state;
}
