# Daily Check

하루 단위 할 일, 일정, 메모, 서랍 체크리스트를 관리하는 정적 웹앱.

## 기술 스택

- React 19 + TypeScript
- Vite + Tailwind CSS
- Supabase Auth/DB/Realtime/Edge Functions
- Vercel 배포

## 로컬 실행

```bash
npm install
npm run dev -- --host
```

환경변수는 `.env.local`에 둡니다.

```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

## 폰에서 테스트

`npm run dev -- --host` 실행 후 Vite가 표시하는 `Network` 주소로 접속합니다.

예: `http://192.168.0.10:3000`

Supabase 로그인 테스트를 하려면 이 Network 주소를 Supabase Auth Redirect URLs에 등록해야 합니다.

## 배포

`main`에 `git push`하면 Vercel이 자동 배포합니다.

```bash
git push
```

## Edge Function

Edge Function 코드는 `supabase/functions/` 아래에 기록용으로 보관합니다.

배포는 Supabase 콘솔에서 합니다. 현재 함수:

- `supabase/functions/prioritize/index.ts`

## 문서

- `docs/`: 기획서, 버전별 프롬프트, 작업 메모
- `CLAUDE.md`: 에이전트 작업 규칙
- `AGENTS.md`: Codex/OMX 작업 규칙

## 자주 겪은 문제

- CSS 변경이 안 보이면 개발 서버를 재시작합니다.
- 코드 변경이 안 보이면 서비스 워커 해제 후 사이트 데이터를 삭제합니다.
- 브라우저 CORS 오류는 404/401이 가려진 경우가 많습니다. Edge Function은 `curl`로 직접 확인합니다.

```bash
curl.exe -i -X OPTIONS https://<project>.supabase.co/functions/v1/<name>
```
