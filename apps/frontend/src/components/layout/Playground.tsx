import { useAppSelector } from "@/redux/hooks";
import { selectCurrentPlayground } from "@/redux/selectors/layout.selector";
import PanelShell from "./PanelShell";
import ViewRenderer from "./ViewRenderer";
import Default from "./Default";

function Playground() {
  const currentPlayground = useAppSelector(selectCurrentPlayground);

  return (
    <PanelShell className="min-h-0 flex-1">
      <div className="h-full overflow-auto">
        {currentPlayground ? (
          <ViewRenderer viewRef={currentPlayground.viewId} />
        ) : (
          <Default />
        )}
      </div>
    </PanelShell>
  );
}

export default Playground;
