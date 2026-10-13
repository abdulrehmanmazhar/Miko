import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Provider } from "react-redux";
import { ExtensionReduxContext } from "@/extensions/redux-context";
import { Archive, Package, Plus, RefreshCw, Search } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { inventoryStore } from "../redux/store";
import { PageHeader } from "@/components/ui/page-header";
import { serverApi, type ServerRow } from "@/neutralino/api/server";
import {
  createProduct,
  loadProducts,
  selectInventory,
  softDeleteProduct,
} from "../redux/inventory.slice";
import { useI18n } from "@/i18n";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring";

function InventoryContent() {
  const dispatch = useAppDispatch();
  const { t } = useI18n();
  const inventory = useAppSelector(selectInventory);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [references, setReferences] = useState<{
    units: ServerRow[];
    categories: ServerRow[];
    currencies: ServerRow[];
    accounts: ServerRow[];
  }>({ units: [], categories: [], currencies: [], accounts: [] });
  const [form, setForm] = useState({
    name: "",
    sku: "",
    unitId: "",
    categoryId: "",
    currencyId: "",
    inventoryAccountId: "",
    salesAccountId: "",
    cogsAccountId: "",
  });

  const refresh = () => dispatch(loadProducts());
  useEffect(() => {
    void dispatch(loadProducts());
    void Promise.all([
      serverApi.getRows("units"),
      serverApi.getRows("categories"),
      serverApi.getRows("currencies"),
      serverApi.getRows("accounts"),
    ])
      .then(([units, categories, currencies, accounts]) =>
        setReferences({ units, categories, currencies, accounts }),
      )
      .catch((error: Error) => setFormError(error.message));
  }, [dispatch]);

  const filteredProducts = inventory.products.filter((product) => {
    const term = query.toLowerCase();
    return (
      String(product.name ?? "").toLowerCase().includes(term) ||
      String(product.sku ?? "").toLowerCase().includes(term)
    );
  });

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await dispatch(
        createProduct({
          ...form,
          isActive: true,
        }),
      ).unwrap();
      setForm({
        name: "",
        sku: "",
        unitId: "",
        categoryId: "",
        currencyId: "",
        inventoryAccountId: "",
        salesAccountId: "",
        cogsAccountId: "",
      });
      setShowForm(false);
      await refresh().unwrap();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        title={t.inventory.title}
        description={t.inventory.description}
        actions={
          <>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent"
              aria-label={t.inventory.refresh}
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowForm((visible) => !visible)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="size-4" />
              {t.inventory.newProduct}
            </button>
          </>
        }
      />

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label={t.inventory.productCount} value={inventory.products.length} />
          <Metric
            label={t.inventory.activeProducts}
            value={inventory.products.filter((product) => product.isActive).length}
          />
          <Metric
            label={t.inventory.lowStock}
            value={t.inventory.stockViaMovements}
          />
        </div>

        {showForm ? (
          <form
            onSubmit={(event) => void submitProduct(event)}
            className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <h2 className="text-sm font-medium text-foreground">
                {t.inventory.newProduct}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.inventory.referenceHelp}
              </p>
            </div>
            <input
              required
              className={inputClass}
              placeholder={t.inventory.productName}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
            <input
              required
              className={inputClass}
              placeholder={t.inventory.sku}
              value={form.sku}
              onChange={(event) =>
                setForm({ ...form, sku: event.target.value })
              }
            />
            <ReferenceSelect
              label={t.inventory.unit}
              rows={references.units}
              value={form.unitId}
              onChange={(unitId) => setForm({ ...form, unitId })}
            />
            <ReferenceSelect
              label={t.inventory.category}
              rows={references.categories}
              value={form.categoryId}
              onChange={(categoryId) => setForm({ ...form, categoryId })}
            />
            <ReferenceSelect
              label={t.inventory.currency}
              rows={references.currencies}
              value={form.currencyId}
              onChange={(currencyId) => setForm({ ...form, currencyId })}
            />
            <ReferenceSelect
              label={t.inventory.inventoryAccount}
              rows={references.accounts.filter((account) => account.type === "asset")}
              value={form.inventoryAccountId}
              onChange={(inventoryAccountId) =>
                setForm({ ...form, inventoryAccountId })
              }
            />
            <ReferenceSelect
              label={t.inventory.salesAccount}
              rows={references.accounts.filter((account) => account.type === "income")}
              value={form.salesAccountId}
              onChange={(salesAccountId) => setForm({ ...form, salesAccountId })}
            />
            <ReferenceSelect
              label={t.inventory.cogsAccount}
              rows={references.accounts.filter((account) => account.type === "expense")}
              value={form.cogsAccountId}
              onChange={(cogsAccountId) => setForm({ ...form, cogsAccountId })}
            />
            {formError ? (
              <p className="text-sm text-destructive sm:col-span-2">{formError}</p>
            ) : null}
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
                disabled={saving || references.units.length === 0}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? t.inventory.saving : t.inventory.saveProduct}
              </button>
            </div>
          </form>
        ) : null}

        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            className={`${inputClass} max-w-sm`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.inventory.search}
            aria-label={t.inventory.search}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
          {inventory.status === "loading" ? (
            <EmptyState>{t.inventory.loading}</EmptyState>
          ) : inventory.status === "error" ? (
            <EmptyState>{inventory.error}</EmptyState>
          ) : filteredProducts.length === 0 ? (
            <EmptyState>{t.inventory.noProducts}</EmptyState>
          ) : (
            <table className="w-full text-start text-sm">
              <thead className="sticky top-0 bg-muted/70 text-xs text-muted-foreground">
                <tr>
                  {[t.inventory.product, t.inventory.sku, t.inventory.state, ""].map(
                    (heading, index) => (
                      <th className="px-4 py-3 font-medium" key={`${heading}-${index}`}>
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr className="border-t border-border" key={String(product.id)}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Package className="size-4 text-muted-foreground" />
                        {String(product.name)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {String(product.sku)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400">
                        {product.isActive ? t.inventory.active : t.inventory.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button
                        type="button"
                        title={t.inventory.archive}
                        onClick={() => {
                          const id = String(product.id);
                          void dispatch(softDeleteProduct(id))
                            .unwrap()
                            .then(() => void refresh())
                            .catch((error: Error) => setFormError(error.message));
                        }}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Archive className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function ReferenceSelect({
  label,
  rows,
  value,
  onChange,
}: {
  label: string;
  rows: ServerRow[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      {label}
      <select
        required
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">—</option>
        {rows.map((row) => (
          <option key={String(row.id)} value={String(row.id)}>
            {String(row.name ?? row.label ?? row.id)}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      <Package className="size-5 opacity-50" />
      {children}
    </div>
  );
}

export default function InventoryPlayground() {
  return (
    <Provider store={inventoryStore} context={ExtensionReduxContext}>
      <InventoryContent />
    </Provider>
  );
}
