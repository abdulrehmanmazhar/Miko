import { UsersRound } from "lucide-react";
import { registerExtension } from "@/utils/extensions";
import PartiesPlayground from "./components/Playground";

registerExtension({
  id: "figgoparties",
  name: "Contacts",
  description: "Manage customers and local user records",
  icon: UsersRound,
  position: "top",
  views: {
    playground: PartiesPlayground,
  },
});
