// BUILD_ID는 빌드할 때 vite 플러그인이 커밋 해시(또는 타임스탬프)로 바꿉니다.
// 값이 고정이면 sw.js 내용이 배포마다 같아서 브라우저가 새 워커를 설치하지 않고,
// 옛 캐시도 그대로 남습니다.
const BUILD_ID = '__BUILD_ID__'.includes('BUILD_ID') ? 'dev' : '__BUILD_ID__';
const CACHE_NAME = `daily-check-${BUILD_ID}`;

// 셸은 install 때 미리 받아둔다. 오프라인 첫 진입에 필요하다.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

// 파일명에 해시가 붙는 빌드 산출물. 내용이 바뀌면 이름도 바뀌므로 캐시를 먼저 본다.
const HASHED_ASSET_PATH = '/assets/';

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// 페이지가 [새로고침]을 누르면 대기 중인 워커를 바로 활성화한다.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase 호출과 GET이 아닌 요청은 건드리지 않는다.
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/rest/v1') ||
    url.pathname.includes('/auth/v1') ||
    url.pathname.startsWith('/api')
  ) {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // HTML은 network-first. 셸을 캐시에서 먼저 주면 배포해도 옛 화면이 계속 나온다.
  // 새 index.html 안에 새 자산 파일명이 들어 있으므로 여기서 막히면 전부 옛 버전이 된다.
  if (isHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const shell = (await caches.match('/index.html')) || (await caches.match('/'));
          if (shell) return shell;
          return Response.error();
        })
    );
    return;
  }

  // 해시가 붙은 자산과 아이콘 등 정적 파일은 cache-first.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // 해시 없는 파일(아이콘, manifest)은 뒤에서 조용히 갱신해 둔다.
        if (!url.pathname.startsWith(HASHED_ASSET_PATH)) {
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const copy = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
              }
            })
            .catch(() => {
              /* 오프라인이면 캐시 그대로 쓴다 */
            });
        }
        return cached;
      }

      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      });
    })
  );
});
