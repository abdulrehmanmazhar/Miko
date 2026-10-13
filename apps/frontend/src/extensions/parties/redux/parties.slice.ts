import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { serverApi, type ServerRow } from "@/neutralino/api/server";

type PartiesState = {
  contacts: ServerRow[];
  users: ServerRow[];
  accounts: ServerRow[];
  status: "idle" | "loading" | "ready" | "error";
  saving: boolean;
  error: string | null;
};

const initialState: PartiesState = {
  contacts: [],
  users: [],
  accounts: [],
  status: "idle",
  saving: false,
  error: null,
};

export const loadParties = createAsyncThunk("parties/load", async () => {
  const [contacts, users, accounts] = await Promise.all([
    serverApi.getRows("contacts"),
    serverApi.getRows("users"),
    serverApi.getRows("accounts"),
  ]);
  return { contacts, users, accounts };
});

export const createContact = createAsyncThunk(
  "parties/createContact",
  (values: ServerRow) => serverApi.createRow("contacts", values),
);

export const createUser = createAsyncThunk(
  "parties/createUser",
  (values: ServerRow) => serverApi.createRow("users", values),
);

const partiesSlice = createSlice({
  name: "parties",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadParties.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadParties.fulfilled, (state, action) => {
        Object.assign(state, action.payload);
        state.status = "ready";
      })
      .addCase(loadParties.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Could not load contacts.";
      })
      .addMatcher(
        (action) =>
          action.type === createContact.pending.type ||
          action.type === createUser.pending.type,
        (state) => {
          state.saving = true;
          state.error = null;
        },
      )
      .addMatcher(
        (action) =>
          action.type === createContact.fulfilled.type ||
          action.type === createUser.fulfilled.type,
        (state) => {
          state.saving = false;
        },
      )
      .addMatcher(
        (action) =>
          action.type === createContact.rejected.type ||
          action.type === createUser.rejected.type,
        (state, action) => {
          state.saving = false;
          state.error =
            (action as { error?: { message?: string } }).error?.message ??
            "Could not save record.";
        },
      );
  },
});

export const selectParties = (state: { parties: PartiesState }) =>
  state.parties;
export default partiesSlice.reducer;
