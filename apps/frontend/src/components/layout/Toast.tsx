import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { selectCurrentToasts } from "@/redux/selectors/layout.selector";
import { dismissToast } from "@/utils/layout-actions";
import ViewRenderer from "./ViewRenderer";

function ToastItem({
  id,
  viewId,
  duration = 5000,
}: {
  id: string;
  viewId: `${string}.${string}`;
  duration?: number;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = setTimeout(() => {
      dismissToast(dispatch, id);
    }, duration);
    return () => clearTimeout(timer);
  }, [dispatch, id, duration]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card shadow-lg",
      )}
    >
      <button
        type="button"
        onClick={() => dismissToast(dispatch, id)}
        className={cn(
          "absolute end-2 top-2 z-10 flex size-6 items-center justify-center",
          "rounded-md text-muted-foreground transition-colors",
          "hover:bg-accent hover:text-foreground",
        )}
        aria-label="Dismiss toast"
      >
        <X className="size-3.5" />
      </button>
      <ViewRenderer viewRef={viewId} />
    </div>
  );
}

function Toast() {
  const currentToasts = useAppSelector(selectCurrentToasts);

  if (currentToasts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute end-4 bottom-4 z-50 flex w-80 flex-col gap-2">
      {currentToasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem
            id={toast.id}
            viewId={toast.view.viewId}
            duration={toast.duration}
          />
        </div>
      ))}
    </div>
  );
}

export default Toast;
