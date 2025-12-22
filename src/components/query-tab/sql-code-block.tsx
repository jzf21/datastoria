import { Play } from "lucide-react";
import { ThemedSyntaxHighlighter } from "../themed-syntax-highlighter";
import { Button } from "../ui/button";
import { QueryExecutor } from "./query-execution/query-executor";

interface SqlCodeBlockProps {
  code: string;
  language?: string;
  customStyle?: React.CSSProperties;
  showExecuteButton?: boolean;
  showLineNumbers?: boolean;
}

export function SqlCodeBlock({
  code,
  language = "sql",
  customStyle,
  showExecuteButton = false,
  showLineNumbers,
}: SqlCodeBlockProps) {
  const defaultStyle: React.CSSProperties = {
    margin: 0,
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    marginTop: "0.5rem",
    marginBottom: "0.5rem",
    ...customStyle,
  };

  const content = (
    <ThemedSyntaxHighlighter
      language={language}
      customStyle={defaultStyle}
      showLineNumbers={showLineNumbers}
    >
      {code}
    </ThemedSyntaxHighlighter>
  );

  if (!showExecuteButton || language !== "sql") {
    return content;
  }

  return (
    <div className="relative group">
      {content}
      <Button
        size="icon"
        variant="secondary"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
        onClick={(e) => {
          e.stopPropagation();
          QueryExecutor.sendQueryRequest(code, {
            params: {
              default_format: "PrettyCompactMonoBlock",
              output_format_pretty_color: 0,
              output_format_pretty_max_value_width: 50000,
              output_format_pretty_max_rows: 500,
              output_format_pretty_row_numbers: true,
            },
          });
        }}
        title="Execute SQL"
      >
        <Play className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

