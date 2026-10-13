import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { serverApi, type ServerRow } from "@/neutralino/api/server";

type InventoryState = {
  products: ServerRow[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  saving: boolean;
};

const initialState: InventoryState = {
  products: [],
  status: "idle",
  error: null,
  saving: false,
};

export const loadProducts = createAsyncThunk(
  "inventory/loadProducts",
  () => serverApi.getRows("products"),
);

export const createProduct = createAsyncThunk(
  "inventory/createProduct",
  (values: ServerRow) => serverApi.createRow("products", values),
);

export const softDeleteProduct = createAsyncThunk(
  "inventory/softDeleteProduct",
  (id: string) => serverApi.deleteRow("products", id),
);

const inventorySlice = createSlice({
  name: "inventory",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadProducts.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadProducts.fulfilled, (state, action) => {
        state.products = action.payload;
        state.status = "ready";
      })
      .addCase(loadProducts.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Could not load products.";
      })
      .addCase(createProduct.pending, (state) => {
        state.saving = true;
      })
      .addCase(createProduct.fulfilled, (state) => {
        state.saving = false;
      })
      .addCase(createProduct.rejected, (state, action) => {
        state.saving = false;
        state.error = action.error.message ?? "Could not create product.";
      })
      .addCase(softDeleteProduct.fulfilled, (state, action) => {
        const id = action.meta.arg;
        state.products = state.products.filter((product) => product.id !== id);
      });
  },
});

export const selectInventory = (state: { inventory: InventoryState }) =>
  state.inventory;
export default inventorySlice.reducer;
