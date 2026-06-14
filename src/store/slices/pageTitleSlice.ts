import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface PageTitleState {
  title:    string | null;
  backPath: string | null;
}

const initialState: PageTitleState = { title: null, backPath: null };

const pageTitleSlice = createSlice({
  name: "pageTitle",
  initialState,
  reducers: {
    setPageTitle(state, action: PayloadAction<PageTitleState>) {
      state.title    = action.payload.title;
      state.backPath = action.payload.backPath;
    },
    clearPageTitle() {
      return initialState;
    },
  },
});

export const { setPageTitle, clearPageTitle } = pageTitleSlice.actions;
export const selectPageTitle = (state: any) => state.pageTitle as PageTitleState;
export default pageTitleSlice.reducer;
