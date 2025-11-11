import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiErrorResponse } from "@/lib/api";
import { Api } from "@/lib/api";
import type { Connection } from "@/lib/connection/Connection";
import { ensureConnectionRuntimeInitialized } from "@/lib/connection/Connection";
import { ConnectionManager } from "@/lib/connection/ConnectionManager";
import type { QueryContext } from "@/lib/query-context/QueryContext";
import { QueryContextManager } from "@/lib/query-context/QueryContextManager";
import { TextHighlighter } from "@/lib/text-highlighter";
import { toastManager } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Info, Plus, Trash2, X } from "lucide-react";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactDOM from "react-dom/client";
import ReactMarkdown from "react-markdown";

interface SettingRow {
  name: string;
  type: string;
  value: string;
  description: string;
}

// Reusable component for rendering markdown descriptions
function SettingDescription({ description }: { description: string }) {
  return (
    <div className="text-sm text-foreground [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:mb-2 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:mb-2 [&_strong]:font-semibold [&_em]:italic">
      <ReactMarkdown>{description || "No description available."}</ReactMarkdown>
    </div>
  );
}

interface SystemSetting {
  name: string;
  type: string;
  description: string;
  default: string;
}

export interface ShowQueryContextEditDialogOptions {
  onCancel?: () => void;
}

interface SettingNameInputWithSuggestionsProps {
  row: SettingRow;
  rowIndex: number;
  availableSettings: SystemSetting[];
  existingRows: SettingRow[];
  onNameChange?: (index: number, name: string) => void;
  onCancel: () => void;
  isLastRow?: boolean;
}

function SettingNameInputWithSuggestions({
  row,
  rowIndex,
  availableSettings,
  existingRows,
  onNameChange,
  onCancel,
  isLastRow = false,
}: SettingNameInputWithSuggestionsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(row.name);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const suggestionListRef = useRef<SettingSuggestionListHandle>(null);
  const hasAutoOpenedRef = useRef(false); // Track if we've already auto-opened this row

  // Sync inputValue with row.name when row changes (but not when editing)
  useEffect(() => {
    if (!isEditing) {
      setInputValue(row.name);
    }
  }, [row.name, isEditing]);

  // Filter out settings that are already used in other rows
  const availableSettingsForRow = useMemo(() => {
    return availableSettings.filter((s) => !existingRows.some((r, i) => i !== rowIndex && r.name === s.name));
  }, [availableSettings, existingRows, rowIndex]);

  // Initialize search when dropdown opens
  const inputValueRef = useRef(inputValue);
  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    if (dropdownPosition && suggestionListRef.current) {
      // Use a small delay to ensure the component is mounted
      setTimeout(() => {
        if (suggestionListRef.current) {
          suggestionListRef.current.search(inputValueRef.current);
        }
      }, 0);
    }
  }, [dropdownPosition]); // Only run when dropdownPosition changes

  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current && isEditing) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 400),
      });
    }
  }, [isEditing]);

  // Automatically enter edit mode when row name is empty (new row)
  // Only auto-edit if this is the last row to prevent multiple rows from editing simultaneously
  // Use a ref to ensure this only happens once per row, not every time isEditing changes
  useEffect(() => {
    if (!row.name.trim() && !isEditing && isLastRow && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true; // Mark that we've auto-opened this row
      setIsEditing(true);
      // Focus the input after a brief delay to ensure it's rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          updateDropdownPosition();
        }
      }, 0);
    }
  }, [row.name, isEditing, isLastRow, updateDropdownPosition]);

  const handleFocus = useCallback(() => {
    setIsEditing(true);
    setInputValue(row.name);

    setTimeout(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
      updateDropdownPosition();
    }, 0);
  }, [row.name, updateDropdownPosition]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      updateDropdownPosition();
      // Update the row name as user types
      if (onNameChange) {
        onNameChange(rowIndex, value);
      }
      // Update search in suggestion list
      if (dropdownPosition && suggestionListRef.current) {
        suggestionListRef.current.search(value);
      }
    },
    [updateDropdownPosition, onNameChange, rowIndex, dropdownPosition]
  );

  const handleSelectSetting = useCallback(
    (setting: SystemSetting) => {
      // Update the name via onNameChange
      if (onNameChange) {
        onNameChange(rowIndex, setting.name);
      }
      setIsEditing(false);
      setDropdownPosition(null);
    },
    [onNameChange, rowIndex]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Handle ESC key even when there are no filtered settings
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation(); // Prevent dialog from closing
        if (dropdownPosition !== null) {
          // If dropdown is open, only close the dropdown (keep editing mode)
          setDropdownPosition(null);
        } else {
          // If dropdown is not open, exit edit mode and close the dialog
          setIsEditing(false);
          onCancel();
        }
        return;
      }

      // Arrow keys and Enter only work when dropdown is open
      if (!dropdownPosition) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        suggestionListRef.current?.nextItem();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        suggestionListRef.current?.prevItem();
      } else if (e.key === "Enter") {
        e.preventDefault();
        suggestionListRef.current?.selectCurrent();
      }
    },
    [onCancel, dropdownPosition]
  );

  // Update dropdown position when input position changes
  useEffect(() => {
    if (isEditing && inputRef.current) {
      updateDropdownPosition();

      const handleScroll = () => updateDropdownPosition();
      const handleResize = () => updateDropdownPosition();

      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);

      const tableContainer = inputRef.current.closest('[class*="max-h"]');
      if (tableContainer) {
        tableContainer.addEventListener("scroll", handleScroll);
      }

      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
        if (tableContainer) {
          tableContainer.removeEventListener("scroll", handleScroll);
        }
      };
    } else {
      setDropdownPosition(null);
    }
  }, [isEditing, updateDropdownPosition]);

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Check if click is on the input
      if (inputRef.current && inputRef.current.contains(target)) {
        return;
      }

      // Check if click is on the dropdown using data attribute (most reliable)
      const clickedDropdown = target.closest('[data-setting-suggestion-dropdown="true"]');
      if (clickedDropdown) {
        return;
      }

      // Also check by ref as fallback
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return;
      }

      // Click is outside both input and dropdown
      // For new rows with empty name, call onCancel to remove the row
      // For existing rows, just close the edit mode
      if (!row.name.trim() && onCancel) {
        onCancel();
      } else {
        setIsEditing(false);
        setInputValue(row.name);
        setDropdownPosition(null);
      }
    };

    // Use mousedown to catch before focus changes
    // Small delay to ensure the dropdown is rendered and refs are set
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing, row.name, onCancel]);

  if (isEditing) {
    return (
      <>
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="Type to search settings..."
          className="w-full h-8"
          autoFocus
        />
        {dropdownPosition &&
          createPortal(
            <SettingSuggestionList
              ref={suggestionListRef}
              settings={availableSettingsForRow}
              onSelect={handleSelectSetting}
              initialSelectedIndex={null}
              dropdownRef={dropdownRef}
              position={dropdownPosition}
            />,
            document.body
          )}
      </>
    );
  }

  return (
    <div
      className="text-sm font-medium truncate cursor-pointer hover:underline min-h-[32px] flex items-center"
      onClick={handleFocus}
    >
      {row.name || <span className="text-muted-foreground italic">Click to edit</span>}
    </div>
  );
}

export interface SettingSuggestionListHandle {
  nextItem: () => void;
  prevItem: () => void;
  selectCurrent: () => void;
  search: (searchValue: string) => void;
}

interface SettingSuggestionListProps {
  settings: SystemSetting[];
  onSelect: (setting: SystemSetting) => void;
  initialSelectedIndex?: number | null;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  position?: { top: number; left: number; width: number };
}

const SettingSuggestionList = forwardRef<SettingSuggestionListHandle, SettingSuggestionListProps>(
  ({ settings, onSelect, initialSelectedIndex = null, dropdownRef, position }, ref) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(initialSelectedIndex);
    const selectedIndexRef = useRef<number | null>(initialSelectedIndex);
    const [searchValue, setSearchValue] = useState<string>("");

    // Filter settings based on search value
    const filteredSettings = useMemo(() => {
      if (!searchValue.trim()) {
        return settings;
      }

      const searchLower = searchValue.toLowerCase();
      return settings
        .filter((s) => s.name.toLowerCase().includes(searchLower))
        .sort((a, b) => {
          const aNameMatch = a.name.toLowerCase().startsWith(searchLower);
          const bNameMatch = b.name.toLowerCase().startsWith(searchLower);
          if (aNameMatch && !bNameMatch) return -1;
          if (!aNameMatch && bNameMatch) return 1;
          return a.name.localeCompare(b.name);
        });
    }, [settings, searchValue]);

    // Update selectedIndex when initialSelectedIndex changes (but only if it's different)
    useEffect(() => {
      if (initialSelectedIndex !== null && initialSelectedIndex !== undefined) {
        setSelectedIndex(initialSelectedIndex);
        selectedIndexRef.current = initialSelectedIndex;
      }
    }, [initialSelectedIndex]);

    const rowVirtualizer = useVirtualizer({
      count: filteredSettings.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 32, // Fixed height per item (single line)
      overscan: 5,
    });

    // Helper function to scroll to an index
    const scrollToIndex = useCallback(
      (index: number) => {
        if (index >= 0 && index < filteredSettings.length && parentRef.current) {
          try {
            rowVirtualizer.scrollToIndex(index, {
              align: "start",
              behavior: "auto",
            });
          } catch (error) {
            // Ignore scroll errors (e.g., if index is out of bounds)
            console.warn("Failed to scroll to index:", index, error);
          }
        }
      },
      [filteredSettings.length, rowVirtualizer]
    );

    // Expose imperative methods
    useImperativeHandle(
      ref,
      () => ({
        nextItem: () => {
          if (filteredSettings.length === 0) return;
          const newIndex =
            selectedIndexRef.current === null || selectedIndexRef.current === undefined
              ? 0
              : Math.min(selectedIndexRef.current + 1, filteredSettings.length - 1);

          selectedIndexRef.current = newIndex;
          setSelectedIndex(newIndex);
          scrollToIndex(newIndex);
        },
        prevItem: () => {
          if (filteredSettings.length === 0) return;
          const newIndex =
            selectedIndexRef.current === null || selectedIndexRef.current === undefined
              ? filteredSettings.length - 1
              : Math.max(selectedIndexRef.current - 1, 0);

          selectedIndexRef.current = newIndex;
          setSelectedIndex(newIndex);
          scrollToIndex(newIndex);
        },
        selectCurrent: () => {
          const currentIndex = selectedIndexRef.current;
          if (currentIndex !== null && currentIndex !== undefined && filteredSettings[currentIndex]) {
            onSelect(filteredSettings[currentIndex]);
          }
        },
        search: (value: string) => {
          setSearchValue(value);
          // Reset selection when search changes
          selectedIndexRef.current = null;
          setSelectedIndex(null);
        },
      }),
      [filteredSettings, onSelect, scrollToIndex]
    );

    const displayedSetting =
      selectedIndex !== null && selectedIndex !== undefined ? filteredSettings[selectedIndex] : null;

    // Calculate width and maxWidth internally
    const width = displayedSetting ? "800px" : "400px";
    const maxWidth = position ? `calc(100vw - ${position.left}px - 16px)` : undefined;

    if (filteredSettings.length === 0) {
      return <div className="p-4 text-sm text-muted-foreground text-center">No settings found.</div>;
    }

    const content = (
      <div className="flex w-full">
        {/* Left: List of names */}
        <div
          ref={parentRef}
          className={cn(
            "w-[400px] max-h-[300px] overflow-y-auto shrink-0 self-start bg-popover border",
            displayedSetting ? "rounded-l-md" : "rounded-md"
          )}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const setting = filteredSettings[virtualRow.index];
              const isSelected = selectedIndex === virtualRow.index;

              return (
                <div
                  key={setting.name}
                  data-index={virtualRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onMouseEnter={() => {
                    selectedIndexRef.current = virtualRow.index;
                    setSelectedIndex(virtualRow.index);
                  }}
                  onMouseLeave={() => {
                    // Don't clear selectedIndex here - let it persist for keyboard navigation
                  }}
                >
                  <div
                    className={cn(
                      "px-3 py-1.5 cursor-pointer transition-colors flex items-center",
                      isSelected && "bg-accent text-accent-foreground"
                    )}
                    onMouseDown={(e) => {
                      // Prevent input blur when clicking dropdown item
                      e.preventDefault();
                      // Select the setting
                      onSelect(setting);
                    }}
                  >
                    <span className="font-medium text-sm flex-1 min-w-0 truncate">
                      {TextHighlighter.highlight(setting.name, searchValue, "text-yellow-500 dark:text-yellow-400")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Description panel - only show when an item is selected */}
        {displayedSetting && (
          <div className="w-[400px] max-h-[300px] overflow-y-auto p-3 bg-popover self-start border rounded-r-md">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-2">
                Type: <span className="font-mono">{displayedSetting.type}</span>
              </div>
              <SettingDescription description={displayedSetting.description} />
            </div>
          </div>
        )}
      </div>
    );

    // If position is provided, wrap in the positioned div with calculated width
    if (position) {
      return (
        <div
          ref={dropdownRef}
          data-setting-suggestion-dropdown="true"
          className="fixed shadow-lg z-[10000]"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: width,
            maxWidth: maxWidth,
          }}
        >
          {content}
        </div>
      );
    }

    // Otherwise return content directly
    return content;
  }
);
SettingSuggestionList.displayName = "SettingSuggestionList";

interface SettingTableRowProps {
  row: SettingRow;
  index: number;
  availableSettings: SystemSetting[];
  existingRows: SettingRow[];
  onNameChange: (index: number, name: string) => void;
  renderValueInput: (row: SettingRow, index: number) => React.ReactNode;
  handleRemoveRow: (index: number) => void;
}

function SettingTableRow({
  row,
  index,
  availableSettings,
  existingRows,
  onNameChange,
  renderValueInput,
  handleRemoveRow,
}: SettingTableRowProps) {
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovering(false);
    setMousePosition(null);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const rowContent = (
    <TableRow key={index} className="h-10">
      <TableCell className="py-1.5">
        <SettingNameInputWithSuggestions
          row={row}
          rowIndex={index}
          availableSettings={availableSettings}
          existingRows={existingRows}
          onNameChange={onNameChange}
          onCancel={() => handleRemoveRow(index)}
          isLastRow={index === existingRows.length - 1}
        />
      </TableCell>
      <TableCell className="py-1.5">
        <div className="text-sm text-muted-foreground truncate">{row.type}</div>
      </TableCell>
      <TableCell className="py-1.5 min-w-[150px]">{renderValueInput(row, index)}</TableCell>
      <TableCell className="py-1.5">
        <div className="flex items-center gap-1">
          {row.description && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(index)} className="h-7 w-7">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <>
      {rowContent}
      {row.description &&
        isHovering &&
        mousePosition &&
        createPortal(
          <div
            className="fixed z-[10001] w-[300px] max-h-[300px] overflow-y-auto p-3 rounded-md border shadow-lg bg-popover border-muted/50 pointer-events-none"
            style={{
              left: `${mousePosition.x + 10}px`,
              top: `${mousePosition.y + 10}px`,
              transform: "translate(0, 0)",
            }}
            onMouseEnter={(e) => {
              e.stopPropagation();
            }}
          >
            <SettingDescription description={row.description} />
          </div>,
          document.body
        )}
    </>
  );
}

function QueryContextEditDialogWrapper({ onCancel }: { onCancel?: () => void }) {
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [availableSettings, setAvailableSettings] = useState<SystemSetting[]>([]);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Get connection from ConnectionManager (since dialog is rendered outside React tree)
  useEffect(() => {
    const connection = ConnectionManager.getInstance().getLastSelectedOrFirst();
    if (connection) {
      const initialized = ensureConnectionRuntimeInitialized(connection);
      setSelectedConnection(initialized);
    }
  }, []);

  // Load current query context (stored only, without defaults)
  useEffect(() => {
    const context = QueryContextManager.getInstance().getStoredContext();
    const contextRows: SettingRow[] = [];

    // Add known context properties
    if (context.opentelemetry_start_trace_probability !== undefined) {
      contextRows.push({
        name: "opentelemetry_start_trace_probability",
        type: "Bool",
        value: String(context.opentelemetry_start_trace_probability),
        description: "Enable OpenTelemetry Tracing",
      });
    }
    if (context.output_format_pretty_row_numbers !== undefined) {
      contextRows.push({
        name: "output_format_pretty_row_numbers",
        type: "Bool",
        value: String(context.output_format_pretty_row_numbers),
        description: "Show row numbers in query results",
      });
    }
    if (context.output_format_pretty_max_rows !== undefined) {
      contextRows.push({
        name: "output_format_pretty_max_rows",
        type: "UInt64",
        value: String(context.output_format_pretty_max_rows),
        description: "Maximum number of result rows",
      });
    }
    if (context.max_execution_time !== undefined) {
      contextRows.push({
        name: "max_execution_time",
        type: "UInt64",
        value: String(context.max_execution_time),
        description: "Maximum execution time in seconds",
      });
    }

    // Add any other custom settings from context
    Object.keys(context).forEach((key) => {
      if (!["isTracingEnabled", "showRowNumber", "maxResultRows", "maxExecutionTime", "format"].includes(key)) {
        const value = context[key];
        if (value !== undefined) {
          contextRows.push({
            name: key,
            type: typeof value === "boolean" ? "Bool" : typeof value === "number" ? "UInt64" : "String",
            value: String(value),
            description: `${key}`,
          });
        }
      }
    });

    setRows(contextRows);
  }, []);

  // Load available settings from system.settings
  const loadAvailableSettings = useCallback(async () => {
    if (!selectedConnection) {
      toastManager.show("No connection selected", "error");
      return;
    }

    try {
      const api = Api.create(selectedConnection);
      const response = await api.executeAsync({
        sql: "SELECT name, type, description, default FROM system.settings ORDER BY name",
        params: {
          default_format: "JSONCompact",
        },
      });

      const data = response.data as { data?: Array<[string, string, string, string]> };
      if (data.data) {
        const settings: SystemSetting[] = data.data.map(([name, type, description, defaultValue]) => ({
          name,
          type,
          description: description || "",
          default: defaultValue || "",
        }));
        setAvailableSettings(settings);
        setHasLoadedSettings(true);

        // Update row descriptions when settings are loaded
        setRows((currentRows) => {
          return currentRows.map((row) => {
            if (!row.name) return row; // Skip empty rows

            const matchedSetting = settings.find((s) => s.name === row.name);
            if (matchedSetting && matchedSetting.description) {
              return { ...row, description: matchedSetting.description };
            }
            return row;
          });
        });
      }
    } catch (error) {
      const apiError = error as ApiErrorResponse;
      toastManager.show(`Failed to load settings: ${apiError.errorMessage}`, "error");
    }
  }, [selectedConnection]);

  // Load available settings when connection is available
  useEffect(() => {
    if (selectedConnection && !hasLoadedSettings) {
      loadAvailableSettings();
    }
  }, [selectedConnection, hasLoadedSettings, loadAvailableSettings]);

  const handleClose = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  const handleSave = useCallback(() => {
    // Build context from table rows only (table is the source of truth)
    const context: Partial<QueryContext> = {};

    // Validate and build context from rows
    for (const row of rows) {
      const { name, type, value } = row;
      if (name.trim() === "") continue;

      let parsedValue: unknown;
      switch (type) {
        case "Bool":
          parsedValue = value === "true" || value === "1";
          break;
        case "Int64":
        case "UInt64":
        case "Int32":
        case "UInt32":
        case "Int16":
        case "UInt16":
        case "Int8":
        case "UInt8":
          parsedValue = parseInt(value, 10);
          if (isNaN(parsedValue as number)) {
            toastManager.show(`Invalid number for ${name}`, "error");
            return;
          }
          break;
        case "Float64":
        case "Float32":
          parsedValue = parseFloat(value);
          if (isNaN(parsedValue as number)) {
            toastManager.show(`Invalid number for ${name}`, "error");
            return;
          }
          break;
        default:
          parsedValue = value;
      }

      context[name] = parsedValue;
    }

    QueryContextManager.getInstance().setContext(context);
    toastManager.show("Query context saved", "success");
    handleClose();
  }, [rows, handleClose]);

  const handleRemoveRow = useCallback(
    (index: number) => {
      setRows(rows.filter((_, i) => i !== index));
    },
    [rows]
  );

  const handleValueChange = useCallback(
    (index: number, value: string) => {
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], value };
      setRows(newRows);
    },
    [rows]
  );

  const handleNameChange = useCallback(
    (index: number, name: string) => {
      const newRows = [...rows];
      // Check if this name matches a setting from availableSettings
      const matchedSetting = availableSettings.find((s) => s.name === name);

      if (matchedSetting) {
        // If it's a known setting, update name, type, description, and default value
        // Also check if already exists in other rows
        if (rows.some((r, i) => i !== index && r.name === matchedSetting.name)) {
          toastManager.show(`Setting ${matchedSetting.name} already exists`, "error");
          return;
        }
        newRows[index] = {
          name: matchedSetting.name,
          type: matchedSetting.type,
          value: matchedSetting.default || "",
          description: matchedSetting.description,
        };
      } else {
        // Just update the name
        newRows[index] = { ...newRows[index], name };
      }
      setRows(newRows);
    },
    [rows, availableSettings]
  );

  const handleAddRow = useCallback(() => {
    const newRow: SettingRow = { name: "", type: "String", value: "", description: "" };
    setRows([...rows, newRow]);

    // Scroll to bottom after a brief delay to ensure the row is rendered
    setTimeout(() => {
      if (tableScrollRef.current) {
        tableScrollRef.current.scrollTop = tableScrollRef.current.scrollHeight;
      }
    }, 0);
  }, [rows]);

  const renderValueInput = (row: SettingRow, index: number) => {
    switch (row.type) {
      case "Bool":
        return (
          <Switch
            checked={row.value === "true" || row.value === "1"}
            onCheckedChange={(checked) => handleValueChange(index, String(checked))}
          />
        );
      case "Int64":
      case "UInt64":
      case "Int32":
      case "UInt32":
      case "Int16":
      case "UInt16":
      case "Int8":
      case "UInt8":
      case "Float64":
      case "Float32":
        return (
          <Input
            type="number"
            value={row.value}
            onChange={(e) => handleValueChange(index, e.target.value)}
            className="w-full h-8"
          />
        );
      default:
        return (
          <Input
            type="text"
            value={row.value}
            onChange={(e) => handleValueChange(index, e.target.value)}
            className="w-full h-8"
          />
        );
    }
  };

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
        <div className="w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
          <Card className="w-full relative flex-shrink-0">
            {/* Close Button - Top Right inside Card */}
            <Button variant="ghost" size="icon" onClick={handleClose} className="absolute top-2 right-2 h-8 w-8 z-10">
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle>Query Context</CardTitle>
              <CardDescription>Configure query execution settings and parameters.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-md overflow-visible">
                  <div ref={tableScrollRef} className="h-[500px] overflow-y-auto overflow-x-visible">
                    <Table>
                      <TableHeader>
                        <TableRow className="h-9">
                          <TableHead className="w-[200px] py-2">Name</TableHead>
                          <TableHead className="w-[120px] py-2">Type</TableHead>
                          <TableHead className="min-w-[150px] py-2">Value</TableHead>
                          <TableHead className="w-[60px] py-2"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                              No settings configured. Click "Add Setting" to get started.
                            </TableCell>
                          </TableRow>
                        ) : (
                          rows.map((row, index) => (
                            <SettingTableRow
                              key={index}
                              row={row}
                              index={index}
                              availableSettings={availableSettings}
                              existingRows={rows}
                              onNameChange={handleNameChange}
                              renderValueInput={renderValueInput}
                              handleRemoveRow={handleRemoveRow}
                            />
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex justify-between items-center gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddRow}
                    disabled={!selectedConnection}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Setting
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleSave}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function showQueryContextEditDialog(options: ShowQueryContextEditDialogOptions = {}) {
  const { onCancel } = options;

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
  root.render(<QueryContextEditDialogWrapper onCancel={cleanup} />);
}
