import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.tsx';
import { scheduleUpdateChecks } from './utils/swUpdate.ts';
import { captureKeyFromUrl } from './utils/panel.ts';

captureKeyFromUrl(); // an installer's #key=... link: kept on the phone, taken out of the address bar
registerSW({
  immediate: true, // caches the static assets so the app loads offline
  // An installed app that stays open never looks for a new version by itself: check hourly and on return to the foreground.
  onRegisteredSW: (_url, reg) => {
    if (reg) scheduleUpdateChecks(reg);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
