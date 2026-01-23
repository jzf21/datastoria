import { LanguageModelProviderFactory } from "@/lib/ai/llm/llm-provider-factory";
import { ModelSelectorImpl } from "./model-selector-impl";

interface ModelSelectorProps {
  className?: string;
}

/**
 * Server Component wrapper for ModelSelectorImpl.
 * Checks if auto-select is available by attempting to call autoSelectModel()
 * and passes the availability status to the client component.
 */
export function ModelSelector({ className }: ModelSelectorProps) {
  let autoSelectAvailable = false;

  try {
    // Try to auto-select a model - if this succeeds, auto-select is available
    LanguageModelProviderFactory.autoSelectModel();
    autoSelectAvailable = true;
  } catch {
    // If autoSelectModel() throws, auto-select is not available
    // autoSelectAvailable remains false
  }

  return <ModelSelectorImpl className={className} autoSelectAvailable={autoSelectAvailable} />;
}
