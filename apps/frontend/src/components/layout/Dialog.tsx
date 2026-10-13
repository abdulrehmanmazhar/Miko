import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { selectCurrentDialog } from "@/redux/selectors/layout.selector";
import { closeDialog } from "@/utils/layout-actions";
import { setDialogCollapsed } from "@/redux/slices/layout.slice";
import ViewRenderer from "./ViewRenderer";

function Dialog() {
  const currentDialog = useAppSelector(selectCurrentDialog);
  const dispatch = useAppDispatch();

  const isOpen = !currentDialog.collapsed && !!currentDialog.view;
  const isFullscreen = currentDialog.fullscreen;

  useEffect(() => {
    if (!isOpen || isFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatch(setDialogCollapsed(true));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, isOpen, isFullscreen]);

  if (!isOpen) return null;

  if (isFullscreen) {
    return (
      <div className="absolute inset-0 z-50 bg-background">
        <ViewRenderer viewRef={currentDialog.view!.viewId} />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={() => closeDialog(dispatch)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative m-4 flex max-h-[85vh] flex-col overflow-hidden",
          "rounded-xl border border-border bg-card shadow-2xl",
        )}
        style={{
          width: currentDialog.width,
          maxWidth: "90vw",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => closeDialog(dispatch)}
          className={cn(
            "absolute end-3 top-3 z-10 flex size-7 items-center justify-center",
            "rounded-md text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-foreground",
          )}
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </button>

        <div className="overflow-auto">
          <ViewRenderer viewRef={currentDialog.view!.viewId} />
        </div>
      </div>
    </div>
  );
}

export default Dialog;
