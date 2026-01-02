import { DashboardPanel } from "@/components/shared/dashboard/dashboard-panel";
import type { AppUIMessage, ToolPart } from "@/lib/ai/common-types";
import { SERVER_TOOL_NAMES } from "@/lib/ai/server-tools";
import { memo } from "react";
import type { PanelDescriptor } from "../../shared/dashboard/dashboard-model";
import { CollapsiblePart } from "./collapsible-part";

export const MessageToolGenerateVisualization = memo(function MessageToolGenerateVisualization({
  part,
}: {
  part: AppUIMessage["parts"][0];
}) {
  const toolPart = part as ToolPart & { output?: PanelDescriptor };
  const panelDescriptor = toolPart.output;
  const state = toolPart.state;
  const isComplete = state === "output-available";

  if (isComplete && (!panelDescriptor || panelDescriptor.type === "none")) {
    // Defensive
    return null;
  }
  if (panelDescriptor) {
    if (panelDescriptor.titleOption === undefined) {
      // Defensive programming
      panelDescriptor.titleOption = {
        title: "",
      };
    }
    panelDescriptor.titleOption.showRefreshButton = true;
    if (panelDescriptor.height === undefined) {
      panelDescriptor.height = 300;
    }
  }

  return (
    <>
      <CollapsiblePart
        toolName={SERVER_TOOL_NAMES.GENEREATE_VISUALIZATION}
        state={state}
        defaultExpanded={false}
      ></CollapsiblePart>
      {isComplete && (
        <div className="h-[300px]">
          <DashboardPanel descriptor={panelDescriptor as PanelDescriptor} />
        </div>
      )}
    </>
  );
});
