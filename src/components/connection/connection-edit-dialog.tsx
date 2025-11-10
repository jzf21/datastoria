import FloatingProgressBar from "@/components/floating-progress-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldDescription } from "@/components/ui/field-description";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/use-dialog";
import type { ApiCanceller, ApiErrorResponse } from "@/lib/api";
import { Api } from "@/lib/api";
import type { Connection } from "@/lib/connection/Connection";
import { ensureConnectionRuntimeInitialized } from "@/lib/connection/Connection";
import { useConnection } from "@/lib/connection/ConnectionContext";
import { ConnectionManager } from "@/lib/connection/ConnectionManager";
import axios from "axios";
import { AlertCircle, CheckCircle2, Eye, EyeOff, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";

export interface ConnectionEditDialogProps {
  connection: Connection | null;
  onClose: () => void;
}

export interface ShowConnectionEditDialogOptions {
  connection: Connection | null;
  onSave?: (connection: Connection) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

// Wrapper component that includes form and buttons with shared state
function ConnectionEditDialogWrapper({
  connection,
  onSave,
  onDelete,
  onCancel,
  isAddMode,
}: {
  connection: Connection | null;
  onSave?: (connection: Connection) => void;
  onDelete?: () => void;
  onCancel?: () => void;
  isAddMode: boolean;
}) {
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { setSelectedConnection } = useConnection();

  const hasProvider = import.meta.env.VITE_CONSOLE_CONNECTION_PROVIDER_ENABLED === "true";

  // View Model
  const [name, setName] = useState(connection ? connection.name : "");
  const [cluster, setCluster] = useState(connection ? connection.cluster : "");
  const [url, setUrl] = useState(connection ? connection.url : "");
  const [user, setUser] = useState(connection ? connection.user : "");
  const [password, setPassword] = useState(connection ? connection.password : "");
  const [editable, setEditable] = useState(connection ? connection.editable : true);
  const [currentSelectedConnection, setCurrentSelectedConnection] = useState<Connection | null>(connection);

  const [apiCanceller, setApiCanceller] = useState<ApiCanceller>();
  const [connectionTemplates, setConnectionTemplates] = useState<Connection[]>(
    isAddMode ? [] : ConnectionManager.getInstance().getConnections()
  );

  // UI state
  const [isShowPassword, setShowPassword] = useState(false);
  const [isLoadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingTemplateError, setLoadingTemplateError] = useState<ApiErrorResponse | undefined>();

  // Error and message state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAddMode || !hasProvider) return;

    setLoadingTemplates(true);

    const templateUrl =
      import.meta.env.MODE === "development"
        ? import.meta.env.VITE_CONSOLE_CONNECTION_PROVIDER_ENDPOINT_DEV
        : import.meta.env.VITE_CONSOLE_CONNECTION_PROVIDER_ENDPOINT_PRD;

    const apiController = new AbortController();
    axios
      .get(templateUrl as string, {
        signal: apiController.signal,
      })
      .then((response) => {
        interface ConnectionTemplate {
          url: string;
          name: string;
          label?: string;
          isCluster?: boolean;
        }
        const connectionTemplates = response.data as ConnectionTemplate[];

        const newConnections: Connection[] = connectionTemplates.map((conn) => {
          return {
            url: conn.url,
            name: conn.label === undefined ? conn.name : conn.label,
            user: "",
            password: "",
            cluster: conn.isCluster ? conn.name : "",
            editable: false,
          };
        });

        setConnectionTemplates(newConnections);
        setLoadingTemplateError(undefined);
      })
      .catch((error) => {
        setLoadingTemplateError({
          errorMessage: "Failed to loading templates: " + error.message,
          httpHeaders: error.response?.headers,
          httpStatus: error.response?.status,
          data: error.response?.data,
        });
      })
      .finally(() => {
        setLoadingTemplates(false);
      });

    return () => {
      apiController.abort();
    };
  }, [hasProvider, isAddMode]);

  const clearFieldErrors = useCallback(() => {
    setFieldErrors({});
    setGeneralError(null);
  }, []);

  const setFieldError = useCallback((field: string, error: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const getEditingConnection = useCallback((): Connection | undefined => {
    clearFieldErrors();

    let hasError = false;

    if (name.trim().length === 0) {
      setFieldError("name", "Name can't be empty.");
      hasError = true;
    }

    let cURL;
    try {
      cURL = new URL(url.trim());
    } catch {
      setFieldError("url", "URL is invalid.");
      hasError = true;
    }
    if (cURL && cURL.protocol !== "http:" && cURL.protocol !== "https:") {
      setFieldError("url", "URL must start with http:// or https://");
      hasError = true;
    }
    if (cURL && cURL.pathname === "") {
      cURL.pathname = "/";
    }

    const userText = user.trim();
    if (userText.length === 0) {
      setFieldError("user", "User can't be empty.");
      hasError = true;
    }

    if (hasError) {
      return;
    }

    const newConnection: Connection = {
      name: name,
      url: cURL!.href,
      user: userText,
      password: password,
      cluster: cluster.trim(),
      editable: editable,
    };

    return newConnection;
  }, [name, cluster, url, user, password, editable, clearFieldErrors, setFieldError]);

  // Save handler
  const stableHandleSave = useCallback(async (): Promise<boolean> => {
    const editingConnection = getEditingConnection();
    if (editingConnection == null) {
      return false; // Keep dialog open
    }

    clearFieldErrors();
    setGeneralError(null);

    const manager = ConnectionManager.getInstance();

    if (isAddMode) {
      // For a new connection, the name must not be in the saved connection
      if (manager.contains(editingConnection.name)) {
        setFieldError(
          "name",
          `There's already a connection with the name [${editingConnection.name}]. Please change the connection name to continue.`
        );
        return false; // Keep dialog open
      }

      manager.add(editingConnection);
    } else {
      // edit mode
      // If name changed, the name must not be in the saved connection
      if (editingConnection.name !== currentSelectedConnection?.name) {
        if (manager.contains(editingConnection.name)) {
          setFieldError(
            "name",
            `There's already a connection with the name [${editingConnection.name}]. Please change the connection name to continue.`
          );
          return false; // Keep dialog open
        }
      }

      manager.replace(currentSelectedConnection!.name, editingConnection);
    }

    // Get the saved connection from manager to ensure consistency
    const savedConnection = manager.getConnections().find((conn) => conn.name === editingConnection.name);
    if (!savedConnection) {
      setGeneralError("Failed to retrieve saved connection from ConnectionManager.");
      return false; // Keep dialog open
    }

    // Update the selected connection to the newly saved/edited connection
    // This will also initialize the connection runtime and save it as the last selected
    setSelectedConnection(savedConnection);
    if (onSave) {
      onSave(savedConnection);
    }
    return true; // Close dialog
  }, [
    getEditingConnection,
    currentSelectedConnection,
    isAddMode,
    onSave,
    setSelectedConnection,
    clearFieldErrors,
    setFieldError,
  ]);

  useEffect(() => {
    return () => {
      // cancel any inflight request on unmount
      apiCanceller?.cancel();
    };
  }, [apiCanceller]);

  // Memoize template selection handler
  const handleTemplateSelect = useCallback((conn: Connection) => {
    setCurrentSelectedConnection(conn);
    setCluster(conn.cluster);
    setEditable(conn.editable);
    setName(conn.name);
    setUrl(conn.url);
    setUser(conn.user);
    setPassword(conn.password);
  }, []);

  // Memoize input onChange handlers to prevent unnecessary re-renders
  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUrl(e.target.value);
      if (fieldErrors.url) {
        setFieldError("url", "");
      }
    },
    [fieldErrors.url, setFieldError]
  );

  const handleUserChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUser(e.target.value);
      if (fieldErrors.user) {
        setFieldError("user", "");
      }
    },
    [fieldErrors.user, setFieldError]
  );

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value), []);

  const handleClusterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setCluster(e.target.value), []);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
      if (fieldErrors.name) {
        setFieldError("name", "");
      }
    },
    [fieldErrors.name, setFieldError]
  );

  // Memoize connection selector to prevent unnecessary re-renders
  const renderConnectionSelector = useMemo(() => {
    if (!hasProvider) return null;

    return (
      <div className="space-y-2">
        <FieldLabel>{isAddMode ? "Templates(Optional)" : "Connections"}</FieldLabel>
        {isLoadingTemplates && <div>Loading...</div>}
        {!isLoadingTemplates && loadingTemplateError !== undefined && (
          <div className="text-sm text-destructive">{loadingTemplateError.errorMessage}</div>
        )}
        {!isLoadingTemplates && loadingTemplateError === undefined && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                {currentSelectedConnection ? currentSelectedConnection.name : "Select a template..."}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full">
              <DropdownMenuLabel>Templates</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {connectionTemplates.map((conn) => (
                <DropdownMenuItem key={conn.name} onClick={() => handleTemplateSelect(conn)}>
                  {conn.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }, [
    hasProvider,
    isAddMode,
    isLoadingTemplates,
    loadingTemplateError,
    currentSelectedConnection,
    connectionTemplates,
    handleTemplateSelect,
  ]);

  // Test handler that manages testing state
  const handleTestConnection = useCallback(async () => {
    const testConnection = getEditingConnection();
    if (testConnection == null) {
      return;
    }

    // Clear previous test results
    setTestResult(null);
    setGeneralError(null);

    // Set testing state to true
    setIsTesting(true);

    // Helper function to set test result with delay
    const setTestResultWithDelay = (result: { type: "success" | "error"; message: string }) => {
      setTimeout(() => {
        setIsTesting(false);
        setTestResult(result);
        // Popover will open automatically via useEffect when testResult is set
      }, 300); // 300ms delay for smooth UI transition
    };

    try {
      const initializedConnection = ensureConnectionRuntimeInitialized(testConnection);
      if (!initializedConnection || !initializedConnection.runtime) {
        setTestResultWithDelay({
          type: "error",
          message: "Failed to initialize connection. Please check your URL format.",
        });
        return;
      }

      const api = Api.create(initializedConnection);

      // Create abort controller for cancellation
      const abortController = new AbortController();
      setApiCanceller({
        cancel: () => abortController.abort(),
      });

      try {
        const response = await api.executeAsync({ sql: "SELECT 525" }, abortController.signal);

        if (testConnection.cluster.length === 0) {
          setApiCanceller(undefined);
          if (response.httpHeaders["x-clickhouse-format"] == null) {
            setTestResultWithDelay({
              type: "error",
              message:
                "Successfully connected. But the response from ClickHouse server might not be configured correctly that this console does not support all features. Maybe there is a CORS problem at the server side.",
            });
          } else {
            setTestResultWithDelay({
              type: "success",
              message: "Successfully connected.",
            });
          }
          return;
        }

        // For CLUSTER MODE, continue to check if the cluster exists
        try {
          const clusterResponse = await api.executeAsync(
            {
              sql: `SELECT 1 FROM system.clusters WHERE cluster = '${testConnection.cluster}' Format JSONCompact`,
            },
            abortController.signal
          );

          setApiCanceller(undefined);
          if (clusterResponse.data.data.length === 0) {
            setTestResultWithDelay({
              type: "error",
              message: `Cluster [${testConnection.cluster}] is not found on given ClickHouse server.`,
            });
          } else {
            setTestResultWithDelay({
              type: "success",
              message: "Successfully connected to specified cluster.",
            });
          }
        } catch (clusterError: unknown) {
          const error = clusterError as ApiErrorResponse;
          setApiCanceller(undefined);
          setTestResultWithDelay({
            type: "error",
            message: `Successfully connected to ClickHouse server. But unable to determine if the cluster [${testConnection.name}] exists on the server. You can still save the connection to continue. ${
              error.httpStatus !== 404 ? error.errorMessage : ""
            }`,
          });
        }
      } catch (error: unknown) {
        setApiCanceller(undefined);

        const apiError = error as ApiErrorResponse;

        // Authentication fails
        if (
          apiError.httpStatus === 403 &&
          apiError.httpHeaders &&
          apiError.httpHeaders["x-clickhouse-exception-code"] === "516"
        ) {
          setTestResultWithDelay({
            type: "error",
            message: "User name or password is wrong.",
          });
          return;
        }

        // try to detect if the error object has 'message' field and then use it if it has
        const detailMessage =
          typeof apiError?.data == "object"
            ? apiError.data?.message
              ? apiError.data.message
              : JSON.stringify(apiError.data, null, 2)
            : apiError?.data;

        setTestResultWithDelay({
          type: "error",
          message: `${apiError.errorMessage}${detailMessage ? `\n${detailMessage}` : ""}`,
        });
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      setTestResultWithDelay({
        type: "error",
        message: `Internal Error\n${errorMessage}`,
      });
    }
  }, [getEditingConnection, setApiCanceller]);

  // Save handler
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await stableHandleSave();
      // stableHandleSave already handles calling onSave and closing
    } finally {
      setIsSaving(false);
    }
  }, [stableHandleSave]);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  const handleClose = useCallback(() => {
    handleCancel();
  }, [handleCancel]);

  const handleDelete = useCallback(() => {
    Dialog.confirm({
      title: "Confirm deletion",
      mainContent: "Are you sure you want to delete this connection? This action cannot be undone.",
      dialogButtons: [
        {
          text: "Delete",
          default: true,
          onClick: async () => {
            if (connection) {
              ConnectionManager.getInstance().remove(connection.name.trim());
              if (onDelete) {
                onDelete();
              }
            }
            return true;
          },
        },
        {
          text: "Cancel",
          default: false,
          onClick: async () => true,
        },
      ],
    });
  }, [connection, onDelete]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [handleClose]);

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
      {/* Main Content - Centered */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-8 relative">
        <div className="w-full max-w-3xl flex flex-col">
          <Card className={`w-full ${testResult ? "rounded-b-none" : ""} relative`}>
            {/* Floating Progress Bar - positioned at top of Card */}
            <FloatingProgressBar show={isTesting || isSaving} />
            {/* Close Button - Top Right inside Card */}
            <Button variant="ghost" size="icon" onClick={handleClose} className="absolute top-2 right-2 h-8 w-8 z-10">
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle>{isAddMode ? "Create a new connection" : "Modify existing connection"}</CardTitle>
              <CardDescription>Configure your ClickHouse connection settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave();
                }}
              >
                <FieldGroup>
                  {hasProvider && <Field>{renderConnectionSelector}</Field>}

                  <Field className="grid grid-cols-[128px_1fr] gap-x-2 gap-y-1 items-center">
                    <FieldLabel htmlFor="url" className="text-right">
                      URL
                    </FieldLabel>

                    <Input
                      id="url"
                      placeholder="http(s)://"
                      value={url}
                      onChange={handleUrlChange}
                      className={fieldErrors.url ? "border-destructive" : ""}
                    />
                    <div></div>
                    {fieldErrors.url ? (
                      <FieldDescription className="text-destructive">{fieldErrors.url}</FieldDescription>
                    ) : (
                      <FieldDescription>The HTTP(s) URL of the ClickHouse server</FieldDescription>
                    )}
                  </Field>

                  <Field className="grid grid-cols-[128px_1fr] gap-x-2 gap-y-1 items-center">
                    <FieldLabel htmlFor="user" className="text-right">
                      User
                    </FieldLabel>
                    <Input
                      id="user"
                      value={user}
                      onChange={handleUserChange}
                      className={fieldErrors.user ? "border-destructive" : ""}
                    />
                    <div></div>
                    {fieldErrors.user ? (
                      <FieldDescription className="text-destructive">{fieldErrors.user}</FieldDescription>
                    ) : (
                      <FieldDescription>The user name to access the ClickHouse server</FieldDescription>
                    )}
                  </Field>

                  <Field className="grid grid-cols-[128px_1fr] gap-x-2 gap-y-1 items-center">
                    <FieldLabel htmlFor="password" className="text-right">
                      Password
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id="password"
                        type={isShowPassword ? "text" : "password"}
                        value={password}
                        onChange={handlePasswordChange}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {isShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div></div>
                    <FieldDescription>
                      The password to access the ClickHouse server. Leave it blank if password is not needed.
                    </FieldDescription>
                  </Field>

                  <Field className="grid grid-cols-[128px_1fr] gap-x-2 gap-y-1 items-center">
                    <FieldLabel htmlFor="cluster" className={`text-right ${!editable ? "text-muted-foreground" : ""}`}>
                      Cluster
                    </FieldLabel>
                    <Input id="cluster" value={cluster} disabled={!editable} onChange={handleClusterChange} />
                    <div></div>
                    <FieldDescription>
                      Configure the cluster name if the ClickHouse server is deployed as cluster to access full features
                      of this console.
                    </FieldDescription>
                  </Field>

                  <Field className="grid grid-cols-[128px_1fr] gap-x-2 gap-y-1 items-center">
                    <FieldLabel htmlFor="name" className="text-right">
                      Connection Name
                    </FieldLabel>
                    <Input
                      id="name"
                      autoFocus
                      value={name}
                      onChange={handleNameChange}
                      className={fieldErrors.name ? "border-destructive" : ""}
                    />
                    <div></div>
                    {fieldErrors.name ? (
                      <FieldDescription className="text-destructive">{fieldErrors.name}</FieldDescription>
                    ) : (
                      <FieldDescription>Name of the connection.</FieldDescription>
                    )}
                  </Field>

                  <FieldGroup>
                    <Field>
                      <div className="flex items-center justify-end gap-2 pt-4 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleTestConnection}
                          disabled={isTesting || isSaving}
                        >
                          {isTesting ? "Testing" : "Test Connection"}
                        </Button>
                        {!isAddMode && onDelete && (
                          <Button type="button" variant="destructive" onClick={handleDelete}>
                            Delete
                          </Button>
                        )}
                        <Button type="button" variant="outline" onClick={handleCancel} disabled={isTesting || isSaving}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isTesting || isSaving}>
                          Save
                        </Button>
                      </div>
                    </Field>
                  </FieldGroup>

                  {/* Alert Area - Below buttons, aligned with inputs (only for general errors, not test results) */}
                  {generalError && (
                    <Field className="grid grid-cols-[128px_1fr] gap-x-2 gap-y-1">
                      <div></div>
                      <Alert variant="destructive" className="border-0 p-3 bg-destructive/10 dark:bg-destructive/20">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <AlertTitle className="text-sm">Error</AlertTitle>
                          <AlertDescription className="mt-1 break-words overflow-wrap-anywhere max-h-32 overflow-y-auto text-xs">
                            {generalError}
                          </AlertDescription>
                        </div>
                      </Alert>
                    </Field>
                  )}
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          {/* Test Result Area - Fixed height below Card (always reserved space) */}
          <div className="h-24 relative overflow-hidden">
            <div
              className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                testResult ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
              }`}
            >
              {testResult && (
                <Card className="w-full rounded-t-none border-t-0 h-full">
                  <CardContent className="p-0 h-full overflow-hidden">
                    <Alert
                      variant={testResult.type === "error" ? "destructive" : "default"}
                      className={`border-0 rounded-t-none p-3 h-full flex items-start ${
                        testResult.type === "error"
                          ? "bg-destructive/10 dark:bg-destructive/20"
                          : "bg-green-500/10 dark:bg-green-500/20"
                      }`}
                    >
                      <div className="flex items-start gap-2 w-full">
                        {testResult.type === "error" ? (
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 overflow-y-auto">
                          <AlertTitle className="text-sm">
                            {testResult.type === "error" ? "Connection Test Failed" : "Connection Test Successful"}
                          </AlertTitle>
                          <AlertDescription className="mt-1 break-words overflow-wrap-anywhere whitespace-pre-wrap text-xs">
                            {testResult.message}
                          </AlertDescription>
                        </div>
                      </div>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function showConnectionEditDialog(options: ShowConnectionEditDialogOptions) {
  const { connection, onSave, onDelete, onCancel } = options;
  const isAddMode = connection == null;

  // Create a container div to mount the full-screen component
  const container = document.createElement("div");
  document.body.appendChild(container);

  // Create React root
  const root = ReactDOM.createRoot(container);

  // Function to cleanup and close
  const cleanup = () => {
    if (container.parentNode) {
      root.unmount();
      document.body.removeChild(container);
    }
    if (onCancel) {
      onCancel();
    }
  };

  // Render the full-screen component
  root.render(
    <ConnectionEditDialogWrapper
      connection={connection}
      onSave={(savedConnection: Connection) => {
        cleanup();
        if (onSave) {
          onSave(savedConnection);
        }
      }}
      onDelete={() => {
        cleanup();
        if (onDelete) {
          onDelete();
        }
      }}
      onCancel={cleanup}
      isAddMode={isAddMode}
    />
  );
}
