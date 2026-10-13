import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Provider } from "react-redux";
import { ExtensionReduxContext } from "@/extensions/redux-context";
import { Check, CircleDollarSign, RefreshCw, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { useI18n } from "@/i18n";
import type { ServerRow } from "@/neutralino/api/server";
import { salesStore } from "../redux/store";
import {
  clearCompletedSale,
  loadSalesReferences,
  selectSales,
  submitSale,
} from "../redux/sales.slice";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring disabled:opacity-50";

function localDateOffset(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function SalesContent() {
  const dispatch = useAppDispatch();
  const { t } = useI18n();
  const state = useAppSelector(selectSales);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [date, setDate] = useState(localDateOffset());
  const [dueDate, setDueDate] = useState(localDateOffset(30));
  const [productId, setProductId] = useState("");
  const [stockId, setStockId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [taxAccountId, setTaxAccountId] = useState("");

  const refresh = () => dispatch(loadSalesReferences());
  useEffect(() => {
    void dispatch(loadSalesReferences());
  }, [dispatch]);

  const availableStock = useMemo(
    () =>
      state.stock.filter(
        (row) =>
          row.productId === productId &&
          Number(row.totalQuantity) > 0 &&
          typeof row.batchId === "string" &&
          typeof row.warehouseId === "string",
      ),
    [productId, state.stock],
  );
  const selectedStock = availableStock.find((row) => row.id === stockId);
  const total = Math.max(
    0,
    Number(quantity || 0) * Number(unitPrice || 0) -
      Number(discount || 0) +
      Number(tax || 0),
  );

  const completeSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const stockRow = selectedStock;
    if (!stockRow) return;
    await dispatch(
      submitSale({
        invoiceNumber,
        customerId,
        createdBy,
        currencyId,
        date: new Date(date).getTime(),
        dueDate: new Date(dueDate).getTime(),
        lines: [
          {
            productId,
            batchId: stockRow.batchId,
            warehouseId: stockRow.warehouseId,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
            discount: Number(discount),
            tax: Number(tax),
            ...(Number(tax) > 0 ? { taxAccountId } : {}),
          },
        ],
      }),
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        title={t.sales.title}
        description={t.sales.description}
        actions={
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent"
            aria-label={t.sales.refresh}
          >
            <RefreshCw className="size-4" />
          </button>
        }
      />
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
        {state.status === "loading" ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            {t.sales.loading}
          </div>
        ) : state.status === "error" ? (
          <Notice tone="error">{state.error}</Notice>
        ) : state.completedSale ? (
          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <Check className="size-6" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t.sales.salePosted}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.sales.invoice} {String(nested(state.completedSale, "invoice", "invoiceNumber") ?? invoiceNumber)}
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-3 text-start">
              <Summary label={t.sales.total} value={formatMinor(nested(state.completedSale, "invoice", "total"))} />
              <Summary label={t.sales.operationId} value={String(state.completedSale.operationId ?? "—")} />
            </div>
            <button
              type="button"
              onClick={() => {
                dispatch(clearCompletedSale());
                setInvoiceNumber("");
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {t.sales.newSale}
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => void completeSale(event)}
            className="grid gap-5 lg:grid-cols-[1fr_320px]"
          >
            <div className="flex flex-col gap-5">
              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="mb-4 text-sm font-medium text-foreground">
                  {t.sales.invoiceDetails}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t.sales.invoiceNumber}>
                    <input required className={inputClass} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
                  </Field>
                  <SelectField
                    label={t.sales.customer}
                    value={customerId}
                    onChange={setCustomerId}
                    rows={state.customers}
                    display={(row) => String(row.name ?? row.id)}
                  />
                  <SelectField
                    label={t.sales.createdBy}
                    value={createdBy}
                    onChange={setCreatedBy}
                    rows={state.users}
                    display={(row) => String(row.name ?? row.id)}
                  />
                  <SelectField
                    label={t.sales.currency}
                    value={currencyId}
                    onChange={setCurrencyId}
                    rows={state.currencies}
                    display={(row) => `${String(row.symbol ?? "")} ${String(row.name ?? row.id)}`}
                  />
                  <Field label={t.sales.saleDate}>
                    <input required type="datetime-local" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} />
                  </Field>
                  <Field label={t.sales.dueDate}>
                    <input required type="datetime-local" className={inputClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                  </Field>
                </div>
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="mb-4 text-sm font-medium text-foreground">
                  {t.sales.saleLine}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label={t.sales.product}
                    value={productId}
                    onChange={(value) => {
                      setProductId(value);
                      setStockId("");
                      const product = state.products.find((row) => row.id === value);
                      setUnitPrice(
                        product && typeof product.extra === "object" && product.extra !== null
                          ? String((product.extra as Record<string, unknown>).salePrice ?? "")
                          : "",
                      );
                    }}
                    rows={state.products}
                    display={(row) => `${String(row.name ?? row.id)} (${String(row.sku ?? "")})`}
                  />
                  <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                    {t.sales.stockBatch}
                    <select required className={inputClass} value={stockId} onChange={(event) => setStockId(event.target.value)} disabled={!productId}>
                      <option value="">—</option>
                      {availableStock.map((row) => (
                        <option key={String(row.id)} value={String(row.id)}>
                          {String(row.batchId)} · {t.sales.available}: {String(row.totalQuantity)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <NumberField label={t.sales.quantity} min="1" value={quantity} onChange={setQuantity} />
                  <NumberField label={t.sales.unitPriceMinor} value={unitPrice} onChange={setUnitPrice} />
                  <NumberField label={t.sales.discountMinor} value={discount} onChange={setDiscount} />
                  <NumberField label={t.sales.taxMinor} value={tax} onChange={setTax} />
                  {Number(tax) > 0 ? (
                    <SelectField
                      label={t.sales.taxAccount}
                      value={taxAccountId}
                      onChange={setTaxAccountId}
                      rows={state.taxAccounts}
                      display={(row) => `${String(row.code)} · ${String(row.name)}`}
                    />
                  ) : null}
                </div>
                {productId && availableStock.length === 0 ? (
                  <p className="mt-3 text-sm text-amber-600">{t.sales.noStock}</p>
                ) : null}
              </section>
            </div>

            <aside className="h-fit rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShoppingCart className="size-4 text-muted-foreground" />
                {t.sales.summary}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">{t.sales.total}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatMinor(total)}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {t.sales.accrualNote}
              </p>
              {state.error ? <Notice tone="error">{state.error}</Notice> : null}
              <button
                type="submit"
                disabled={state.saving || !selectedStock}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CircleDollarSign className="size-4" />
                {state.saving ? t.sales.posting : t.sales.postSale}
              </button>
            </aside>
          </form>
        )}
      </div>
    </div>
  );
}

function nested(row: ServerRow, key: string, childKey: string) {
  const value = row[key];
  return typeof value === "object" && value !== null
    ? (value as ServerRow)[childKey]
    : undefined;
}

function formatMinor(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? (amount / 100).toFixed(2) : "—";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  rows,
  display,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: ServerRow[];
  display: (row: ServerRow) => string;
}) {
  return (
    <Field label={label}>
      <select required className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        {rows.map((row) => (
          <option key={String(row.id)} value={String(row.id)}>
            {display(row)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = "0",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  return (
    <Field label={label}>
      <input required type="number" min={min} step="1" className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function Notice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "error";
}) {
  return (
    <p className={`mt-3 rounded-md p-3 text-sm ${tone === "error" ? "bg-destructive/10 text-destructive" : ""}`}>
      {children}
    </p>
  );
}

export default function SalesPlayground() {
  return (
    <Provider store={salesStore} context={ExtensionReduxContext}>
      <SalesContent />
    </Provider>
  );
}
