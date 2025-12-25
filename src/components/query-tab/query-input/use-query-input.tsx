import { useEffect, useState } from "react";

interface QueryInputState {
  selectedText: string;
  text: string;
}

const globalState: QueryInputState = {
  selectedText: "",
  text: "",
};

const globalListeners: Set<() => void> = new Set();

// Function to update editor state (called from query-input-view)
export function updateQueryInputState(state: Partial<QueryInputState>) {
  let changed = false;

  if (state.selectedText !== undefined && globalState.selectedText !== state.selectedText) {
    globalState.selectedText = state.selectedText;
    changed = true;
  }

  if (state.text !== undefined && globalState.text !== state.text) {
    globalState.text = state.text;
    changed = true;
  }

  if (changed) {
    globalListeners.forEach((listener) => listener());
  }
}

// Hook to track editor state
export function useQueryInput() {
  const [state, setState] = useState<QueryInputState>(globalState);

  useEffect(() => {
    const listener = () => {
      setState({ ...globalState });
    };
    globalListeners.add(listener);
    return () => {
      globalListeners.delete(listener);
    };
  }, []);

  return state;
}
