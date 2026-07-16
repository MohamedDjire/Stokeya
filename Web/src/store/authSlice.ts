import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type User,
} from '../api/auth';
import { getAccessToken, getApiErrorMessage } from '../api/client';

interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: 'idle',
  error: null,
};

export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  if (!getAccessToken()) throw new Error('no token');
  return await fetchMe();
});

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      await apiLogin(payload.email, payload.password);
      return await fetchMe();
    } catch (err) {
      return rejectWithValue(getApiErrorMessage(err, 'Identifiants invalides.'));
    }
  },
);

export const registerThunk = createAsyncThunk(
  'auth/register',
  async (
    payload: {
      company_name: string;
      email: string;
      password: string;
      password_confirm: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      await apiRegister(payload);
      return await fetchMe();
    } catch (err) {
      return rejectWithValue(getApiErrorMessage(err, "Inscription impossible."));
    }
  },
);

export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  await apiLogout();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAuth.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'authenticated';
      })
      .addCase(bootstrapAuth.rejected, (state) => {
        state.status = 'unauthenticated';
      })
      .addCase(loginThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'authenticated';
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.error = (action.payload as string) || 'Connexion impossible.';
      })
      .addCase(registerThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(registerThunk.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'authenticated';
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.error = (action.payload as string) || 'Inscription impossible.';
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = null;
        state.status = 'unauthenticated';
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
