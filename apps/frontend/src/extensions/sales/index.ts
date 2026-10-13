import { ShoppingBag } from "lucide-react";
import { registerExtension } from "@/utils/extensions";
import SalesPlayground from "./components/Playground";

registerExtension({
  id: "figgosales",
  name: "Sales",
  description: "Create and post customer sales",
  icon: ShoppingBag,
  position: "top",
  views: {
    playground: SalesPlayground,
  },
});
