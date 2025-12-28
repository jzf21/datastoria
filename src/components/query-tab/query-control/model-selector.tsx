import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useModelConfig } from "@/hooks/use-model-config";
import type { ModelProps } from "@/lib/ai/llm-provider-factory";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { showSettingsDialog } from "../../settings/settings-dialog";
import { HighlightableCommandItem } from "../../shared/cmdk/cmdk-extension";

interface ModelCommandItemProps {
  model: ModelProps;
  isSelected: boolean;
  onSelect: (modelId: string) => void;
}

function ModelCommandItem({ model, isSelected, onSelect }: ModelCommandItemProps) {
  return (
    <CommandItem
      value={model.modelId}
      onSelect={() => onSelect(model.modelId)}
      className="m-1 text-xs cursor-pointer py-1"
    >
      <Check className={cn("mr-2 h-3 w-3 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
      <div className="flex items-center justify-between gap-2 overflow-hidden w-full text-[10px]">
        <span className={cn("truncate")}>
          <HighlightableCommandItem text={model.modelId} />
        </span>
        <span className={cn("text-[10px] text-muted-foreground shrink-0", model.provider === "System" && "italic")}>
          {model.provider}
        </span>
      </div>
    </CommandItem>
  );
}

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const { availableModels, selectedModelId, setSelectedModelId } = useModelConfig();
  const [highlightedValue, setHighlightedValue] = useState<string | undefined>(selectedModelId);

  useEffect(() => {
    // If no model is selected, or the selected model is no longer available, select 'auto' as default
    if (!selectedModelId || !availableModels.find((m) => m.modelId === selectedModelId)) {
      setSelectedModelId("Auto");
    }
  }, [availableModels, selectedModelId, setSelectedModelId]);

  useEffect(() => {
    if (open) {
      setHighlightedValue(selectedModelId);
    }
  }, [open, selectedModelId]);

  const handleSelect = useCallback(
    (modelId: string) => {
      setSelectedModelId(modelId);
      setOpen(false);
      // Trigger a custom event so other components know the model changed
      window.dispatchEvent(new CustomEvent("MODEL_CHANGED", { detail: { modelId } }));
    },
    [setSelectedModelId]
  );

  const selectedModel = availableModels.find((m) => m.modelId === selectedModelId);

  const highlightedModel = useMemo(() => {
    return availableModels.find((m) => m.modelId === highlightedValue);
  }, [availableModels, highlightedValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-6 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
        >
          <span className="truncate max-w-[350px]">
            {selectedModel ? `${selectedModel.provider} | ${selectedModel.modelId}` : "Select model..."}
          </span>
          <ChevronsUpDown className="ml-0.5 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-auto flex items-start z-[10000] bg-transparent border-0 shadow-none"
        align="start"
        side="top"
      >
        <Command value={highlightedValue} onValueChange={setHighlightedValue}>
          <div className="flex items-start">
            <div
              className={cn(
                "w-[350px] border bg-popover rounded-md overflow-hidden shadow-md",
                highlightedModel?.description ? "rounded-r-none" : ""
              )}
            >
              <CommandInput placeholder="Search models..." className="h-[32px] text-[10px]" />
              <CommandList id="model-list" className="max-h-[300px]">
                <CommandEmpty className="h-[32px] py-2 text-center text-[10px]">No model found.</CommandEmpty>
                {availableModels.map((model) => (
                  <ModelCommandItem
                    key={`${model.provider}-${model.modelId}`}
                    model={model}
                    isSelected={selectedModelId === model.modelId}
                    onSelect={handleSelect}
                  />
                ))}
              </CommandList>
              <div className="h-px bg-border" />
              <div className="h-[32px] items-center flex mx-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-[24px] justify-start px-2 text-[10px] font-normal gap-2 rounded-sm"
                  onClick={() => {
                    setOpen(false);
                    showSettingsDialog({ initialSection: "models" });
                  }}
                >
                  <Settings2 className="h-3 w-3" />
                  Configure AI Models...
                </Button>
              </div>
            </div>

            {highlightedModel?.description && (
              <div className="w-[250px] max-h-[328px] overflow-y-auto p-1 bg-popover rounded-r-md border border-l-0 text-[10px] text-popover-foreground">
                {highlightedModel.description}
              </div>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
