import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { selectCurrentBottomPanel } from "@/redux/selectors/layout.selector";
import { setBottomPanelDimensions } from "@/redux/slices/layout.slice";
import { useCallback, useEffect, useRef } from "react";
import PanelShell from "./PanelShell";
import ViewRenderer from "./ViewRenderer";

function BottomPanel() {
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentBottomPanel = useAppSelector(selectCurrentBottomPanel);
  const dispatch = useAppDispatch();

  const setHeight = useCallback(
    (newHeight: number) => {
      dispatch(
        setBottomPanelDimensions({
          width: currentBottomPanel.width,
          height: `${newHeight}px`,
        }),
      );
    },
    [dispatch, currentBottomPanel.width],
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing.current || !panelRef.current) return;

      const panelBottom = panelRef.current.getBoundingClientRect().bottom;
      const newHeight = panelBottom - event.clientY;
      const minHeight = 100;
      const maxHeight = 400;

      setHeight(Math.min(Math.max(newHeight, minHeight), maxHeight));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setHeight]);

  const handleMouseDown = () => {
    isResizing.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  if (currentBottomPanel.collapsed || !currentBottomPanel.view) return null;

  return (
    <PanelShell
      ref={panelRef}
      className="relative shrink-0"
      style={{ height: currentBottomPanel.height }}
    >
      <div
        onMouseDown={handleMouseDown}
        className="absolute inset-x-0 top-0 z-10 h-1 cursor-row-resize hover:bg-ring/40"
      />
      <div className="h-full overflow-auto">
        <ViewRenderer viewRef={currentBottomPanel.view.viewId} />
      </div>
    </PanelShell>
  );
}

export default BottomPanel;
