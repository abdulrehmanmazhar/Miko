import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { selectActiveExtensionId } from "@/redux/selectors/layout.selector";
import {
  activateExtension,
  getExtensionsByPosition,
  type IExtension,
} from "@/utils/extensions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PanelShell from "./PanelShell";
import { useI18n, type Messages } from "@/i18n";

const EXTENSION_I18N: Record<string, keyof Messages["extensions"]> = {
  figgosettings: "settings",
};

function SidebarSection({
  extensions,
  activeExtensionId,
  onSelect,
  className,
  resolveLabel,
}: {
  extensions: ReturnType<typeof getExtensionsByPosition>;
  activeExtensionId: string | null;
  onSelect: (id: string) => void;
  className?: string;
  resolveLabel: (ext: IExtension) => { name: string; description: string };
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1 py-2", className)}>
      {extensions.map((ext) => {
        const Icon = ext.icon;
        const isActive = activeExtensionId === ext.id;
        const { name, description } = resolveLabel(ext);

        return (
          <Tooltip key={ext.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelect(ext.id)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
                aria-label={name}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="font-medium">{name}</p>
              <p className="text-primary-foreground/70">{description}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function Sidebar() {
  const dispatch = useAppDispatch();
  const { t } = useI18n();
  const activeExtensionId = useAppSelector(selectActiveExtensionId);

  const topExtensions = getExtensionsByPosition("top");
  const bottomExtensions = getExtensionsByPosition("bottom");

  const handleSelect = (id: string) => {
    activateExtension(id, dispatch);
  };

  const resolveLabel = (ext: IExtension) => {
    const key = EXTENSION_I18N[ext.id];
    if (key) {
      return t.extensions[key];
    }
    return { name: ext.name, description: ext.description };
  };

  return (
    <TooltipProvider>
      <PanelShell className="flex h-full w-12 shrink-0 flex-col bg-sidebar">
        <div className="scrollbar-none max-h-[80%] overflow-y-auto">
          <SidebarSection
            extensions={topExtensions}
            activeExtensionId={activeExtensionId}
            onSelect={handleSelect}
            resolveLabel={resolveLabel}
          />
        </div>

        <div className="mt-auto scrollbar-none max-h-[20%] overflow-y-auto">
          <SidebarSection
            extensions={bottomExtensions}
            activeExtensionId={activeExtensionId}
            onSelect={handleSelect}
            resolveLabel={resolveLabel}
          />
        </div>
      </PanelShell>
    </TooltipProvider>
  );
}

export default Sidebar;
