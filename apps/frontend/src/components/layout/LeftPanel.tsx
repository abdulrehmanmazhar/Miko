import { useHorizontalResize } from "@/hooks/useHorizontalResize";
import { useAppSelector } from "@/redux/hooks";
import { selectCurrentLeftPanel } from "@/redux/selectors/layout.selector";
import PanelShell from "./PanelShell";
import ViewRenderer from "./ViewRenderer";

function LeftPanel() {
  const { width, panelRef, handleMouseDown } = useHorizontalResize({
    side: "start",
    initialWidth: 280,
  });

  const currentLeftPanel = useAppSelector(selectCurrentLeftPanel);

  if (currentLeftPanel.collapsed || !currentLeftPanel.view) return null;

  return (
    <PanelShell
      ref={panelRef}
      className="relative h-full shrink-0"
      style={{ width }}
    >
      <div
        onMouseDown={handleMouseDown}
        className="absolute inset-y-0 end-0 z-10 w-1 cursor-col-resize hover:bg-ring/40"
      />
      <div className="h-full overflow-auto">
        <ViewRenderer viewRef={currentLeftPanel.view.viewId} />
      </div>
    </PanelShell>
  );
}

export default LeftPanel;
