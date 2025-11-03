export interface QueryContext {
  [prop: string]: unknown;

  isTracingEnabled?: boolean;
  isProcessorTracingEnabled?: boolean;
  showRowNumber?: boolean;
  maxResultRows?: number;
  maxExecutionTime?: number;
  format?: string;
}

