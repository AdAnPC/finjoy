import { createRoot } from 'react-dom/client';
import { setAuthTokenGetter } from '@workspace/api-client-react';

import App from './App';

import './index.css';

export const ADMIN_KEY_STORAGE = 'finjoy_admin_api_key';

setAuthTokenGetter(() => window.localStorage.getItem(ADMIN_KEY_STORAGE));

const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const token = window.localStorage.getItem(ADMIN_KEY_STORAGE);
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (token && (url.startsWith('/api/') || url === '/api')) {
    const headers = new Headers(init?.headers);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return originalFetch(input, { ...init, headers });
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(<App />);
