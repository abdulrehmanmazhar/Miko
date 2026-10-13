import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Provider } from "react-redux";
import { ExtensionReduxContext } from "@/extensions/redux-context";
import { ContactRound, Plus, RefreshCw, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { useI18n } from "@/i18n";
import { partiesStore } from "../redux/store";
import {
  createContact,
  createUser,
  loadParties,
  selectParties,
} from "../redux/parties.slice";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring";

function PartiesContent() {
  const dispatch = useAppDispatch();
  const { t } = useI18n();
  const state = useAppSelector(selectParties);
  const [section, setSection] = useState<"customers" | "users">("customers");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "customer",
    receivableAccountId: "",
    email: "",
  });
  const [userName, setUserName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refresh = () => dispatch(loadParties());

  useEffect(() => {
    void dispatch(loadParties());
  }, [dispatch]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      if (section === "customers") {
        await dispatch(
          createContact({
            name: form.name,
            type: form.type,
            receivableAccountId: form.receivableAccountId || null,
            email: form.email || null,
            isActive: true,
          }),
        ).unwrap();
        setForm({
          name: "",
          type: "customer",
          receivableAccountId: "",
          email: "",
        });
      } else {
        await dispatch(createUser({ name: userName || null })).unwrap();
        setUserName("");
      }
      setShowForm(false);
      await refresh().unwrap();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const rows =
    section === "customers"
      ? state.contacts.filter(
          (contact) => contact.type === "customer" || contact.type === "both",
        )
      : state.users;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        title={t.parties.title}
        description={t.parties.description}
        actions={
          <>
            <button
              type="button"
              onClick={() => void refresh()}
              aria-label={t.parties.refresh}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowForm((visible) => !visible)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="size-4" />
              {section === "customers" ? t.parties.newCustomer : t.parties.newUser}
            </button>
          </>
        }
      />
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
        <nav className="flex gap-1 border-b border-border">
          {(["customers", "users"] as const).map((id) => (
            <button
              type="button"
              key={id}
              onClick={() => {
                setSection(id);
                setShowForm(false);
              }}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                section === id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {id === "customers" ? t.parties.customers : t.parties.users}
              <span className="ms-2 text-xs tabular-nums text-muted-foreground">
                {id === "customers"
                  ? state.contacts.filter(
                      (contact) =>
                        contact.type === "customer" || contact.type === "both",
                    ).length
                  : state.users.length}
              </span>
            </button>
          ))}
        </nav>

        {showForm ? (
          <form
            onSubmit={(event) => void submit(event)}
            className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2"
          >
            {section === "customers" ? (
              <>
                <input
                  required
                  className={inputClass}
                  placeholder={t.parties.customerName}
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
                <select
                  className={inputClass}
                  value={form.type}
                  onChange={(event) =>
                    setForm({ ...form, type: event.target.value })
                  }
                >
                  <option value="customer">{t.parties.customer}</option>
                  <option value="both">{t.parties.customerAndSupplier}</option>
                </select>
                <input
                  className={inputClass}
                  type="email"
                  placeholder={t.parties.email}
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
                <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  {t.parties.receivableAccount}
                  <select
                    className={inputClass}
                    required
                    value={form.receivableAccountId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        receivableAccountId: event.target.value,
                      })
                    }
                  >
                    <option value="">—</option>
                    {state.accounts
                      .filter((account) => account.type === "asset")
                      .map((account) => (
                        <option key={String(account.id)} value={String(account.id)}>
                          {String(account.code)} · {String(account.name)}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            ) : (
              <input
                className={`${inputClass} sm:col-span-2`}
                placeholder={t.parties.userName}
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
              />
            )}
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
                {state.saving ? t.parties.saving : t.parties.save}
              </button>
            </div>
          </form>
        ) : null}

        {state.status === "loading" ? (
          <EmptyState>{t.parties.loading}</EmptyState>
        ) : state.status === "error" ? (
          <EmptyState>{state.error}</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>{t.parties.empty}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={String(row.id)}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                {section === "customers" ? (
                  <ContactRound className="size-4 text-muted-foreground" />
                ) : (
                  <UserRound className="size-4 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {String(row.name ?? t.parties.unnamed)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {section === "customers"
                      ? String(row.email ?? row.type)
                      : String(row.id)}
                  </p>
                </div>
                {section === "customers" ? (
                  <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">
                    {String(row.type)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <ContactRound className="size-5 opacity-50" />
      {children}
    </div>
  );
}

export default function PartiesPlayground() {
  return (
    <Provider store={partiesStore} context={ExtensionReduxContext}>
      <PartiesContent />
    </Provider>
  );
}
