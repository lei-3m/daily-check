import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { pruneStaleLocalKeys } from './lib/storage';
import { todayKey } from './lib/date';

// 지난 날짜의 carryover 키가 쌓이지 않도록 시작할 때 한 번 정리합니다.
pruneStaleLocalKeys(todayKey());

// Register Service Worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
