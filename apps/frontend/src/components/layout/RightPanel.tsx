import { useHorizontalResize } from "@/hooks/useHorizontalResize";
import { useAppSelector } from "@/redux/hooks";
import { selectCurrentRightPanel } from "@/redux/selectors/layout.selector";
import PanelShell from "./PanelShell";
import ViewRenderer from "./ViewRenderer";

function RightPanel() {
  const { width, panelRef, handleMouseDown } = useHorizontalResize({
    side: "end",
    initialWidth: 280,
  });

  const currentRightPanel = useAppSelector(selectCurrentRightPanel);

  if (currentRightPanel.collapsed || !currentRightPanel.view) return null;

  return (
    <PanelShell
      ref={panelRef}
      className="relative h-full shrink-0"
      style={{ width }}
    >
      <div
        onMouseDown={handleMouseDown}
        className="absolute inset-y-0 start-0 z-10 w-1 cursor-col-resize hover:bg-ring/40"
      />
      <div className="h-full overflow-auto">
        <ViewRenderer viewRef={currentRightPanel.view.viewId} />
      </div>
    </PanelShell>
  );
}

export default RightPanel;
