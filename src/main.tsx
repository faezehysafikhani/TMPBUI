import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installPersianValidationMessages } from './utils/persianValidation';
import { refreshBranding } from './utils/branding';

installPersianValidationMessages();
// The system's name, logo and tab icon as the administrator set them (also before sign-in).
refreshBranding();

// Register Service Worker for PWA App Badging support
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.debug('ServiceWorker registered:', reg.scope);
    }).catch((err) => {
      console.debug('ServiceWorker registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

