import type { AppUIMessage } from "@/lib/ai/common-types";
import { memo } from "react";
import { CollapsiblePart } from "./collapsible-part";

/**
 * Render reasoning part with collapsible display
 */
export const ReasoningPart = memo(function ReasoningPart({
  part,
}: {
  part: AppUIMessage["parts"][0] & { state?: string; text: string };
}) {
  console.log(part);
  return (
    <CollapsiblePart toolName="reasoning" state={part.state}>
      <div className="mt-1 max-h-[300px] overflow-auto text-[10px] text-muted-foreground">
        <pre className="bg-muted/30 rounded overflow-x-auto shadow-sm leading-tight">{part.text}</pre>
      </div>
    </CollapsiblePart>
  );
});
