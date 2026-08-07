import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// public/sw.js는 그대로 복사되므로 캐시 이름이 배포마다 같아진다.
// 파일 내용이 한 글자도 바뀌지 않으면 브라우저는 새 서비스 워커를 설치하지 않는다.
// 빌드 뒤에 dist/sw.js의 __BUILD_ID__를 이번 빌드 식별자로 바꾼다.
function serviceWorkerBuildId(): Plugin {
  const buildId =
    (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 8) || Date.now().toString(36);

  return {
    name: 'service-worker-build-id',
    apply: 'build',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js');
      if (!fs.existsSync(swPath)) return;
      const source = fs.readFileSync(swPath, 'utf8');
      fs.writeFileSync(swPath, source.replace(/__BUILD_ID__/g, buildId));
      this.info?.(`service worker build id: ${buildId}`);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), serviceWorkerBuildId()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
