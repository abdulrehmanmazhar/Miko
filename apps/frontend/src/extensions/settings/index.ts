import { Settings } from "lucide-react";
import { registerExtension } from "@/utils/extensions";
import SettingsLeftPanel from "./components/LeftPanel";
import ThemesPlayground from "./components/ThemesPlayground";

registerExtension({
  id: "figgosettings",
  name: "Settings",
  description: "Configure workspace preferences",
  icon: Settings,
  position: "bottom",
  views: {
    playground: ThemesPlayground,
    leftPanel: SettingsLeftPanel,
  },
});
