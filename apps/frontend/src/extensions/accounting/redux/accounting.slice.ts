import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { serverApi, type ServerRow } from "@/neutralino/api/server";

type AccountingState = {
  accounts: ServerRow[];
  entries: ServerRow[];
  actions: ServerRow[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  saving: boolean;
};

const initialState: AccountingState = {
  accounts: [],
  entries: [],
  actions: [],
  status: "idle",
  error: null,
  saving: false,
};

export const loadAccountingData = createAsyncThunk(
  "accounting/load",
  async () => {
    const [accounts, entries, actions] = await Promise.all([
      serverApi.getRows("accounts"),
      serverApi.getRows("journal_entries"),
      serverApi.getRows("action_records"),
    ]);
    return { accounts, entries, actions };
  },
);

export const createAccount = createAsyncThunk(
  "accounting/createAccount",
  (values: ServerRow) => serverApi.createRow("accounts", values),
);

export const archiveAccount = createAsyncThunk(
  "accounting/archiveAccount",
  (id: string) => serverApi.deleteRow("accounts", id),
);

const accountingSlice = createSlice({
  name: "accounting",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadAccountingData.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadAccountingData.fulfilled, (state, action) => {
        Object.assign(state, action.payload);
        state.status = "ready";
      })
      .addCase(loadAccountingData.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Could not load accounting data.";
      })
      .addCase(createAccount.pending, (state) => {
        state.saving = true;
      })
      .addCase(createAccount.fulfilled, (state) => {
        state.saving = false;
      })
      .addCase(createAccount.rejected, (state, action) => {
        state.saving = false;
        state.error = action.error.message ?? "Could not create account.";
      });
  },
});

export const selectAccounting = (state: { accounting: AccountingState }) =>
  state.accounting;
export default accountingSlice.reducer;
