import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/use-dialog";
import type { ApiCanceller, ApiErrorResponse } from "@/lib/api";
import { Api } from "@/lib/api";
import type { Connection } from "@/lib/connection/Connection";
import { ensureConnectionRuntimeInitialized } from "@/lib/connection/Connection";
import { useConnection } from "@/lib/connection/ConnectionContext";
import { ConnectionManager } from "@/lib/connection/ConnectionManager";
import { toastManager } from "@/lib/toast";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

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

export function showConnectionEditDialog(options: ShowConnectionEditDialogOptions) {
  const { connection, onSave, onDelete, onCancel } = options;
  const isAddMode = connection == null;

  // Use closures to store handlers
  let saveHandler: (() => Promise<boolean>) | null = null;
  let testHandler: (() => void) | null = null;

  const formContent = (
    <ConnectionEditForm
      connection={connection}
      onSaveHandlerRef={(handler) => {
        saveHandler = handler;
      }}
      onTestHandlerRef={(handler) => {
        testHandler = handler;
      }}
      onSave={(conn) => {
        if (onSave) {
          onSave(conn);
        }
      }}
      onDelete={onDelete}
    />
  );

  Dialog.showDialog({
    title: isAddMode ? "Create a new connection" : "Modify an existing connection",
    description: (
      <div>
        <p className="text-sm text-muted-foreground mb-4">Configure your ClickHouse connection settings.</p>
        {formContent}
        <div className="flex gap-2 mt-4 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              if (testHandler) {
                testHandler();
              }
            }}
          >
            Test Connection
          </Button>
          {!isAddMode && onDelete && (
            <Button
              variant="destructive"
              onClick={() => {
                Dialog.confirm({
                  title: "Confirm deletion",
                  description: "Are you sure you want to delete this connection? This action cannot be undone.",
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
              }}
            >
              Delete
            </Button>
          )}
          <DialogClose asChild>
            <Button
              variant="outline"
              onClick={() => {
                if (onCancel) {
                  onCancel();
                }
              }}
            >
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              onClick={async (e) => {
                if (saveHandler) {
                  const shouldClose = await saveHandler();
                  if (!shouldClose) {
                    // Prevent dialog from closing if save validation fails
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                  }
                }
              }}
            >
              Save
            </Button>
          </DialogClose>
        </div>
      </div>
    ),
    className: "max-w-lg",
    dialogButtons: [],
  });
}

interface ConnectionEditFormProps {
  connection: Connection | null;
  onSaveHandlerRef: (handler: () => Promise<boolean>) => void;
  onTestHandlerRef: (handler: () => void) => void;
  onSave: (connection: Connection) => void;
  onDelete?: () => void;
}

function ConnectionEditForm({ connection, onSaveHandlerRef, onTestHandlerRef, onSave }: ConnectionEditFormProps) {
  const isAddMode = connection == null;
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

  const showMessage = (message: string | React.ReactNode) => toastManager.show(message, "success");
  const showErrorMessage = (message: string | React.ReactNode) => toastManager.show(message, "error");

  const getEditingConnection = useCallback((): Connection | undefined => {
    if (name.trim().length === 0) {
      showErrorMessage("Name can't be empty.");
      return;
    }

    let cURL;
    try {
      cURL = new URL(url.trim());
    } catch {
      showErrorMessage("URL is invalid.");
      return;
    }
    if (cURL.protocol !== "http:" && cURL.protocol !== "https:") {
      showErrorMessage("URL must start with http:// or https://");
      return;
    }
    if (cURL.pathname === "") {
      cURL.pathname = "/";
    }

    const userText = user.trim();
    if (userText.length === 0) {
      showErrorMessage("User can't be empty.");
      return;
    }

    const newConnection: Connection = {
      name: name,
      url: cURL.href,
      user: userText,
      password: password,
      cluster: cluster.trim(),
      editable: editable,
    };

    console.log(`Connection: [${newConnection.url}]`);

    return newConnection;
  }, [name, cluster, url, user, password, editable]);

  // Stabilize handlers with useCallback - include the actual handler functions as dependencies
  // Since handleSave and handleTestConnection are defined in this component and depend on state,
  // we recreate them when state changes, so we include all dependencies
  const stableHandleSave = useCallback(async (): Promise<boolean> => {
    const editingConnection = getEditingConnection();
    if (editingConnection == null) {
      return false; // Keep dialog open
    }

    const manager = ConnectionManager.getInstance();

    if (isAddMode) {
      // For a new connection, the name must not be in the saved connection
      if (manager.contains(editingConnection.name)) {
        showErrorMessage(
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
          showErrorMessage(
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
      showErrorMessage("Failed to retrieve saved connection from ConnectionManager.");
      return false; // Keep dialog open
    }

    // Update the selected connection to the newly saved/edited connection
    // This will also initialize the connection runtime and save it as the last selected
    setSelectedConnection(savedConnection);
    onSave(savedConnection);
    return true; // Close dialog
  }, [getEditingConnection, currentSelectedConnection, isAddMode, onSave, setSelectedConnection]);

  const stableHandleTestConnection = useCallback(() => {
    const testConnection = getEditingConnection();
    if (testConnection == null) {
      console.log("Test connection: getEditingConnection returned null");
      return;
    }

    console.log("Test connection: Starting test for", testConnection);

    try {
      const initializedConnection = ensureConnectionRuntimeInitialized(testConnection);
      if (!initializedConnection || !initializedConnection.runtime) {
        console.error("Test connection: Failed to initialize connection runtime", initializedConnection);
        showErrorMessage("Failed to initialize connection. Please check your URL format.");
        return;
      }

      console.log("Test connection: Connection initialized, runtime:", initializedConnection.runtime);
      const api = Api.create(initializedConnection);
      console.log("Test connection: API created, executing SQL...");
      const testCanceller = api.executeSQL(
        { sql: "SELECT 525" },
        (response) => {
          console.log("Test connection: Response received", response);
          if (testConnection.cluster.length === 0) {
            if (response.httpHeaders["x-clickhouse-format"] == null) {
              showErrorMessage(
                "Successfully connected. But the response from ClickHouse server might not be configured correctly that this console does not support all features. Maybe there is a CORS problem at the server side."
              );
            } else {
              showMessage("Successfully connected.");
            }
            return;
          }

          //
          // For CLUSTER MODE, continue to check if the cluster exists
          //
          const clusterCanceller = api.executeSQL(
            {
              sql: `SELECT 1 FROM system.clusters WHERE cluster = '${testConnection.cluster}' Format JSONCompact`,
            },
            (response) => {
              if (response.data.data.length === 0) {
                showErrorMessage(`Cluster [${testConnection.cluster}] is not found on given ClickHouse server.`);
              } else {
                showMessage("Successfully connected to specified cluster.");
              }
            },
            (error) => {
              showErrorMessage(
                `Successfully connected to ClickHouse server. But unable to determine if the cluster [${testConnection.name}] exists on the server. You can still save the connection to continue. ${
                  error.httpStatus !== 404 ? error.errorMessage : ""
                }`
              );
            },
            () => {
              // Test completed
            }
          );

          setApiCanceller(clusterCanceller);
        },
        (error) => {
          console.error("Test connection: Error received", error);
          setApiCanceller(undefined);

          //
          // Authentication fails
          //
          if (
            error.httpStatus === 403 &&
            error.httpHeaders &&
            error.httpHeaders["x-clickhouse-exception-code"] === "516"
          ) {
            showErrorMessage("User name or password is wrong.");
            return;
          }

          // try to detect if the error object has 'message' field and then use it if it has
          const detailMessage =
            typeof error?.data == "object"
              ? error.data.message
                ? error.data.message
                : JSON.stringify(error.data, null, 2)
              : error?.data;

          showErrorMessage(`${error.errorMessage}\n${detailMessage}`);
        },
        () => {
          console.log("Test connection: Request finalized");
        }
      );

      setApiCanceller(testCanceller);
      console.log("Test connection: Request initiated");
    } catch (e: unknown) {
      console.error("Test connection: Exception caught", e);
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      showErrorMessage(`Internal Error\n${errorMessage}`);
    }
  }, [getEditingConnection, setApiCanceller]);

  // Expose handlers via refs
  useEffect(() => {
    onSaveHandlerRef(stableHandleSave);
  }, [stableHandleSave, onSaveHandlerRef]);

  useEffect(() => {
    onTestHandlerRef(stableHandleTestConnection);
  }, [stableHandleTestConnection, onTestHandlerRef]);

  const renderConnectionSelector = () => {
    if (!hasProvider) return null;

    return (
      <div className="space-y-2">
        <Label>{isAddMode ? "Templates(Optional)" : "Connections"}</Label>
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
                <DropdownMenuItem
                  key={conn.name}
                  onClick={() => {
                    setCurrentSelectedConnection(conn);
                    setCluster(conn.cluster);
                    setEditable(conn.editable);
                    setName(conn.name);
                    setUrl(conn.url);
                    setUser(conn.user);
                    setPassword(conn.password);
                  }}
                >
                  {conn.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  useEffect(() => {
    return () => {
      // cancel any inflight request on unmount
      apiCanceller?.cancel();
    };
  }, [apiCanceller]);

  return (
    <div className="space-y-4 py-4">
      {renderConnectionSelector()}

      <div className="space-y-2">
        <Label htmlFor="name">Name (Required)</Label>
        <Input
          id="name"
          autoFocus
          placeholder="name of a connection. Must be unique."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cluster" className={!editable ? "text-muted-foreground" : ""}>
          Cluster (Optional)
        </Label>
        <Input
          id="cluster"
          placeholder="logic cluster name"
          value={cluster}
          disabled={!editable}
          onChange={(e) => setCluster(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">URL (Required)</Label>
        <Input id="url" placeholder="http(s)://" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="user">User (Required)</Label>
        <Input id="user" placeholder="user name" value={user} onChange={(e) => setUser(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            placeholder="password"
            type={isShowPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
      </div>
    </div>
  );
}
