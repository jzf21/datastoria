"use client";

import { buttonVariants } from "@/components/ui/button";
import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Dialog as DialogUI,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

export interface DialogButton {
  text: string;
  default: boolean;
  onClick: () => Promise<boolean>;
}

export interface DialogProps {
  title?: string;
  description?: React.ReactNode;
  className?: string;
  onCancel?: () => void;
  dialogButtons?: DialogButton[];
  /**
   * A callback function that determines whether the dialog can be closed.
   * If it returns true, the dialog will not be closed.
   * If it returns false or is not provided, the dialog can be closed normally.
   */
  disableClose?: () => boolean;
}

interface InternalDialogProps extends DialogProps {
  dispose: () => void;
}

const AlertDialogComponent = (dialogProps: InternalDialogProps) => {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) {
      // Delay disposing the dialog to allow the animation to finish
      setTimeout(() => {
        dialogProps.dispose();
      }, 100);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    // If closing and disableClose callback returns true, prevent closing
    if (!newOpen && dialogProps.disableClose && dialogProps.disableClose()) {
      return;
    }
    setOpen(newOpen);
  };

  const handleInteractOutside = (event: Event) => {
    // If disableClose callback returns true, prevent default behavior
    if (dialogProps.disableClose && dialogProps.disableClose()) {
      event.preventDefault();
      return;
    }
    // Call the onCancel callback if provided
    if (dialogProps.onCancel) {
      dialogProps.onCancel();
    }
  };

  return (
    <DialogUI open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        // The full-screen mode of MUI table has z-index of 1300, so we have to set a larger z-index to make sure the dialog is on top of the table.
        className={cn("flex flex-col gap-2 p-5 justify-between z-[2000]", dialogProps.className)}
        onInteractOutside={handleInteractOutside}
        onEscapeKeyDown={(event) => {
          // Prevent closing on Escape key if disableClose callback returns true
          if (dialogProps.disableClose && dialogProps.disableClose()) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{dialogProps.title}</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <div className="flex-grow mt-3 mb-3 overflow-auto">{dialogProps.description}</div>
        {dialogProps.dialogButtons && dialogProps.dialogButtons.length > 0 && (
          <DialogFooter className="mt-auto">
            {dialogProps.dialogButtons.map((button, index) => (
              <DialogClose
                key={index}
                className={cn(buttonVariants(button.default ? {} : { variant: "outline" }))}
                onClick={async () => {
                  if (await button.onClick()) {
                    setOpen(false);
                  }
                }}
              >
                {button.text}
              </DialogClose>
            ))}
          </DialogFooter>
        )}
      </DialogContent>
    </DialogUI>
  );
};

export class Dialog {
  public static alert(dialogProps: DialogProps) {
    const dialogButtons = dialogProps.dialogButtons ?? [{ text: "OK", onClick: async () => true, default: true }];
    Dialog.showDialog({ ...dialogProps, dialogButtons: dialogButtons });
  }

  public static confirm(dialogProps: DialogProps) {
    const dialogButtons = dialogProps.dialogButtons ?? [
      { text: "Confirm", onClick: async () => true, default: true },
      { text: "Cancel", onClick: async () => true, default: false },
    ];

    Dialog.showDialog({ ...dialogProps, dialogButtons: dialogButtons });
  }

  public static showDialog(dialogProps: DialogProps) {
    const rootElement = document.createElement("div");
    const root = ReactDOM.createRoot(rootElement);

    const dispose = () => {
      root.unmount();
      if (rootElement.parentNode) {
        rootElement.parentNode.removeChild(rootElement);
      }
    };

    // Get current theme from document to match the existing theme state
    // Check multiple ways the theme might be set
    const currentTheme = document.documentElement.classList.contains("dark")
      ? "dark"
      : document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : localStorage.getItem("theme") === "dark"
          ? "dark"
          : "light";

    // Apply the theme class to the dialog root element to ensure proper theming
    rootElement.className = currentTheme;

    // Append to document body so it inherits body styles
    document.body.appendChild(rootElement);

    root.render(
      <ThemeProvider
        attribute="class"
        defaultTheme={currentTheme}
        forcedTheme={currentTheme}
        enableSystem={false}
        disableTransitionOnChange={false}
      >
        <AlertDialogComponent {...dialogProps} dispose={dispose} />
      </ThemeProvider>
    );
  }
}
