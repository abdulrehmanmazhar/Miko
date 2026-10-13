import { Landmark } from "lucide-react";
import { registerExtension } from "@/utils/extensions";
import AccountingPlayground from "./components/Playground";

registerExtension({
  id: "figgoaccounting",
  name: "Accounting",
  description: "Accounts, journals, and audit history",
  icon: Landmark,
  position: "top",
  views: {
    playground: AccountingPlayground,
  },
});
