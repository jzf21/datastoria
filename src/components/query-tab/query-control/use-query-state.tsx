import { useEffect, useState } from "react";

let globalHasSelectedText = false;
let globalListeners: Set<() => void> = new Set();

// Function to update selection state (called from query-input-view)
export function updateHasSelectedText(hasSelected: boolean) {
  if (globalHasSelectedText !== hasSelected) {
    globalHasSelectedText = hasSelected;
    globalListeners.forEach((listener) => listener());
  }
}

// Hook to track selection state
export function useHasSelectedText() {
  const [hasSelectedText, setHasSelectedText] = useState(globalHasSelectedText);

  useEffect(() => {
    const listener = () => {
      setHasSelectedText(globalHasSelectedText);
    };
    globalListeners.add(listener);
    return () => {
      globalListeners.delete(listener);
    };
  }, []);

  return hasSelectedText;
}

