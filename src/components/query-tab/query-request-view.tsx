import { CopyButton } from "@/components/ui/copy-button";
import SyntaxHighlighter from "react-syntax-highlighter";
import { solarizedDark } from "react-syntax-highlighter/dist/cjs/styles/hljs";
import type { QueryRequestViewModel } from "./query-view-model";

interface QueryRequestViewProps {
  queryRequest: QueryRequestViewModel;
}

export function QueryRequestView({ queryRequest }: QueryRequestViewProps) {
  return (
    <div className="query-request">
      <div className="relative group">
        <CopyButton
          value={queryRequest.sql}
          className="right-2 top-1 opacity-0 group-hover:opacity-100 transition-opacity"
        />
        <SyntaxHighlighter
          showLineNumbers={true}
          customStyle={{
            backgroundColor: "rgba(143, 153, 168, 0.15)",
            fontSize: "14px",
            margin: 0,
          }}
          language="sql"
          style={solarizedDark}
        >
          {queryRequest.sql}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
