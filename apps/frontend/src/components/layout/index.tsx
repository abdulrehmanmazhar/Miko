import BottomPanel from "./BottomPanel";
import Dialog from "./Dialog";
import LeftPanel from "./LeftPanel";
import Playground from "./Playground";
import RightPanel from "./RightPanel";
import Sidebar from "./Sidebar";
import Toast from "./Toast";

function Layout() {
  return (
    <div className="relative flex h-full w-full gap-px bg-background p-px">
      <Sidebar />

      <div className="flex min-w-0 flex-1 gap-px">
        <LeftPanel />

        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <Playground />
          <BottomPanel />
        </div>

        <RightPanel />
      </div>

      <Dialog />
      <Toast />
    </div>
  );
}

export default Layout;
