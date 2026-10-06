import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type User,
} from '../api/auth';
import { clearTokens, getAccessToken, getApiErrorMessage } from '../api/client';

interface AuthState {
  user: User | null;
  status: 'idle' | 'bootstrapping' | 'authenticated' | 'unauthenticated';
  busy: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: 'idle',
  busy: false,
  error: null,
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  if (!getAccessToken()) throw new Error('no token');
  try {
    return await withTimeout(fetchMe(), 5000);
  } catch {
    clearTokens();
    throw new Error('session expired');
  }
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
      address?: string;
      city?: string;
      whatsapp?: string;
      shop_slug?: string;
      wave_number?: string;
      orange_money_number?: string;
      payment_timing?: string;
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
        state.status = 'bootstrapping';
      })
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'authenticated';
        state.busy = false;
      })
      .addCase(bootstrapAuth.rejected, (state) => {
        state.status = 'unauthenticated';
        state.busy = false;
      })
      .addCase(loginThunk.pending, (state) => {
        state.busy = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'authenticated';
        state.busy = false;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.busy = false;
        state.error = (action.payload as string) || 'Connexion impossible.';
      })
      .addCase(registerThunk.pending, (state) => {
        state.busy = true;
        state.error = null;
      })
      .addCase(registerThunk.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'authenticated';
        state.busy = false;
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.busy = false;
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
