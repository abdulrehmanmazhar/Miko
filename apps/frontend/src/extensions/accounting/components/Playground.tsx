import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Provider } from "react-redux";
import { ExtensionReduxContext } from "@/extensions/redux-context";
import { BookOpen, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { accountingStore } from "../redux/store";
import {
  archiveAccount,
  createAccount,
  loadAccountingData,
  selectAccounting,
} from "../redux/accounting.slice";
import { useI18n } from "@/i18n";

type Section = "accounts" | "journals" | "actions";
const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring";

function AccountingContent() {
  const dispatch = useAppDispatch();
  const { t } = useI18n();
  const state = useAppSelector(selectAccounting);
  const [section, setSection] = useState<Section>("accounts");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "asset",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);

  const refresh = () => dispatch(loadAccountingData());
  useEffect(() => {
    void dispatch(loadAccountingData());
  }, [dispatch]);

  const addAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await dispatch(
        createAccount({ ...form, isActive: true, isGroup: false }),
      ).unwrap();
      setForm({ code: "", name: "", type: "asset", description: "" });
      setShowForm(false);
      await refresh().unwrap();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const sections: { id: Section; label: string; count: number }[] = [
    { id: "accounts", label: t.accounting.accounts, count: state.accounts.length },
    { id: "journals", label: t.accounting.journalEntries, count: state.entries.length },
    { id: "actions", label: t.accounting.actionHistory, count: state.actions.length },
  ];
  const rows =
    section === "accounts"
      ? state.accounts
      : section === "journals"
        ? state.entries
        : state.actions;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        title={t.accounting.title}
        description={t.accounting.description}
        actions={
          <>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent"
              aria-label={t.accounting.refresh}
            >
              <RefreshCw className="size-4" />
            </button>
            {section === "accounts" ? (
              <button
                type="button"
                onClick={() => setShowForm((visible) => !visible)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="size-4" />
                {t.accounting.newAccount}
              </button>
            ) : null}
          </>
        }
      />
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
        <nav className="flex flex-wrap gap-1 border-b border-border">
          {sections.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                section === item.id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
              <span className="ms-2 text-xs tabular-nums text-muted-foreground">
                {item.count}
              </span>
            </button>
          ))}
        </nav>

        {showForm && section === "accounts" ? (
          <form
            onSubmit={(event) => void addAccount(event)}
            className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2"
          >
            <input
              required
              className={inputClass}
              placeholder={t.accounting.code}
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
            />
            <input
              required
              className={inputClass}
              placeholder={t.accounting.name}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <select
              className={inputClass}
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
            >
              {["asset", "liability", "equity", "income", "expense"].map((type) => (
                <option key={type} value={type}>
                  {t.accounting.types[type as keyof typeof t.accounting.types]}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              placeholder={t.accounting.descriptionField}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
            {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={state.saving}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {state.saving ? t.accounting.saving : t.accounting.saveAccount}
              </button>
            </div>
          </form>
        ) : null}

        {state.status === "loading" ? (
          <EmptyState>{t.accounting.loading}</EmptyState>
        ) : state.status === "error" ? (
          <EmptyState>{state.error}</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>{t.accounting.empty}</EmptyState>
        ) : (
          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full text-start text-sm">
              <thead className="bg-muted/70 text-xs text-muted-foreground">
                <tr>
                  {(section === "accounts"
                    ? [t.accounting.code, t.accounting.name, t.accounting.type]
                    : section === "journals"
                      ? [t.accounting.entryNumber, t.accounting.date, t.accounting.status]
                      : [t.accounting.operation, t.accounting.table, t.accounting.date]
                  ).map((heading) => (
                    <th className="px-4 py-3 font-medium" key={heading}>
                      {heading}
                    </th>
                  ))}
                  {section === "accounts" ? <th className="px-4 py-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={String(row.id ?? `${section}-${index}`)}
                    className="border-t border-border"
                  >
                    {section === "accounts" ? (
                      <>
                        <td className="px-4 py-3 font-mono text-xs">{String(row.code)}</td>
                        <td className="px-4 py-3 font-medium">{String(row.name)}</td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">
                          {String(row.type)}
                        </td>
                        <td className="px-4 py-3 text-end">
                          <button
                            type="button"
                            onClick={() => {
                              void dispatch(archiveAccount(String(row.id)))
                                .unwrap()
                                .then(() => void refresh())
                                .catch((reason: Error) => setError(reason.message));
                            }}
                            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                          >
                            {t.accounting.archive}
                          </button>
                        </td>
                      </>
                    ) : section === "journals" ? (
                      <>
                        <td className="px-4 py-3 font-mono text-xs">
                          {String(row.entryNumber)}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(row.date)}
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">
                          {String(row.status)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-mono text-xs">
                          {String(row.operationId ?? "—")}
                        </td>
                        <td className="px-4 py-3">{String(row.tableName ?? "—")}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(row.createdAt)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(value: unknown) {
  if (value === null || value === undefined) return "—";
  const date = new Date(value instanceof Date ? value : Number(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <BookOpen className="size-5 opacity-50" />
      {children}
    </div>
  );
}

export default function AccountingPlayground() {
  return (
    <Provider store={accountingStore} context={ExtensionReduxContext}>
      <AccountingContent />
    </Provider>
  );
}
