import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserState {
  user_id?: string;
  user_name?: string;
  user_email?: string;
  mobile_no?: string;
  role_name?: string;
  role_id?: string;
  is_active?: boolean;
  profile_image_url?: string | null;
}

const initialState: UserState = {};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUserData: (_state, action: PayloadAction<UserState>) => ({ ...action.payload }),
    clearUserData: () => initialState,
  },
});

export const { setUserData, clearUserData } = userSlice.actions;
export const selectUser = (state: { user: UserState }) => state.user;
export const selectUserData = (state: { user: UserState }) => state.user;
export default userSlice.reducer;
