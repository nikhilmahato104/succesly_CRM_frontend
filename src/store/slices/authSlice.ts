import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// accessToken and csrfToken live in Redux memory ONLY.
// This slice is intentionally NOT included in redux-persist whitelist.
// Tokens are gone on page refresh — AuthContext re-hydrates via POST /auth/refresh.

interface AuthState {
  accessToken: string | null;
  csrfToken:   string | null;
}

const initialState: AuthState = {
  accessToken: null,
  csrfToken:   null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthTokens(state, action: PayloadAction<{ accessToken: string; csrfToken: string }>) {
      state.accessToken = action.payload.accessToken;
      state.csrfToken   = action.payload.csrfToken;
    },
    clearAuthTokens() {
      return initialState;
    },
  },
});

export const { setAuthTokens, clearAuthTokens } = authSlice.actions;

export const selectAccessToken = (state: any): string | null => state.auth?.accessToken ?? null;
export const selectCsrfToken   = (state: any): string | null => state.auth?.csrfToken   ?? null;

export default authSlice.reducer;
