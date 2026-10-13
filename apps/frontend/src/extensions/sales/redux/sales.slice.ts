import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { serverApi, type ServerRow } from "@/neutralino/api/server";

type SalesState = {
  customers: ServerRow[];
  products: ServerRow[];
  stock: ServerRow[];
  currencies: ServerRow[];
  users: ServerRow[];
  taxAccounts: ServerRow[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  saving: boolean;
  completedSale: ServerRow | null;
};

const initialState: SalesState = {
  customers: [],
  products: [],
  stock: [],
  currencies: [],
  users: [],
  taxAccounts: [],
  status: "idle",
  error: null,
  saving: false,
  completedSale: null,
};

export const loadSalesReferences = createAsyncThunk(
  "sales/loadReferences",
  async () => {
    const [contacts, products, stock, currencies, users, accounts] =
      await Promise.all([
        serverApi.getRows("contacts"),
        serverApi.getRows("products"),
        serverApi.getRows("stock"),
        serverApi.getRows("currencies"),
        serverApi.getRows("users"),
        serverApi.getRows("accounts"),
      ]);
    return {
      customers: contacts.filter(
        (row) => row.type === "customer" || row.type === "both",
      ),
      products: products.filter((row) => row.isActive === true),
      stock: stock.filter((row) => row.validTo == null),
      currencies,
      users,
      taxAccounts: accounts.filter((row) => row.type === "liability"),
    };
  },
);

export const submitSale = createAsyncThunk(
  "sales/submit",
  (input: ServerRow) => serverApi.recordSale(input),
);

const salesSlice = createSlice({
  name: "sales",
  initialState,
  reducers: {
    clearCompletedSale: (state) => {
      state.completedSale = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSalesReferences.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadSalesReferences.fulfilled, (state, action) => {
        Object.assign(state, action.payload);
        state.status = "ready";
      })
      .addCase(loadSalesReferences.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Could not load sale data.";
      })
      .addCase(submitSale.pending, (state) => {
        state.saving = true;
        state.error = null;
        state.completedSale = null;
      })
      .addCase(submitSale.fulfilled, (state, action) => {
        state.saving = false;
        state.completedSale = action.payload;
      })
      .addCase(submitSale.rejected, (state, action) => {
        state.saving = false;
        state.error = action.error.message ?? "Could not complete the sale.";
      });
  },
});

export const { clearCompletedSale } = salesSlice.actions;
export const selectSales = (state: { sales: SalesState }) => state.sales;
export default salesSlice.reducer;
