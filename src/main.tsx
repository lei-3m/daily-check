import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { pruneStaleLocalKeys } from './lib/storage';
import { todayKey } from './lib/date';

// 지난 날짜의 carryover 키가 쌓이지 않도록 시작할 때 한 번 정리합니다.
pruneStaleLocalKeys(todayKey());

// 서비스 워커 등록은 App의 useServiceWorkerUpdate가 맡습니다.
// 등록과 새 버전 감지를 한곳에서 해야 대기 중인 워커를 놓치지 않습니다.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
