import { Boxes } from "lucide-react";
import { registerExtension } from "@/utils/extensions";
import InventoryPlayground from "./components/Playground";

registerExtension({
  id: "figgoinventory",
  name: "Inventory",
  description: "Manage products and stock records",
  icon: Boxes,
  position: "top",
  views: {
    playground: InventoryPlayground,
  },
});
