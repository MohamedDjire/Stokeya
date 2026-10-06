import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { store } from './store';
import { LocaleProvider } from './locale/LocaleProvider';
import { hydrateLocaleFromStorage } from './locale/runtime';
import App from './App';

hydrateLocaleFromStorage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <LocaleProvider>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LocaleProvider>
    </Provider>
  </React.StrictMode>,
);
