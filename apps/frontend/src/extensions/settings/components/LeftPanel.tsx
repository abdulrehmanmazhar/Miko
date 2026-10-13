import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { selectCurrentPlayground } from "@/redux/selectors/layout.selector";
import { setPlayground } from "@/redux/slices/layout.slice";
import { SETTINGS_TABS } from "@/extensions/settings/config/tabs";
import type { ViewRef } from "@/utils/views";
import { useI18n } from "@/i18n";

const EXTENSION_ID = "figgosettings";

function SettingsLeftPanel() {
  const dispatch = useAppDispatch();
  const { t } = useI18n();
  const playground = useAppSelector(selectCurrentPlayground);
  const activeViewId = playground?.viewId;

  const navigate = (viewId: ViewRef) => {
    dispatch(setPlayground({ extensionId: EXTENSION_ID, viewId }));
  };

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <h2 className="text-sm font-medium text-foreground">
        {t.settings.title}
      </h2>

      <ul className="flex flex-col gap-1">
        {SETTINGS_TABS.map((tab) => {
          const isActive = activeViewId === tab.playground;

          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => navigate(tab.playground)}
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-start text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {t.settings.tabs[tab.id]}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SettingsLeftPanel;
