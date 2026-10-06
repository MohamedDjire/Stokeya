import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import prefsReducer from './prefsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    prefs: prefsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
