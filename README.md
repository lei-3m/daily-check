# Daily Check (데일리 체크)

하루 단위 체크리스트 및 일정 관리 PWA 웹 애플리케이션입니다.

---

## 🚀 주요 기능

- **일일 체크리스트 & 메모**: 날짜별 할 일 목록 작성, 순서 변경, 삭제 및 메모 기능
- **주간/월간 뷰**: 주간 네비게이션 및 월 달력을 통한 간편한 일정 조회
- **Supabase 동기화**: 로그인 시 클라우드 실시간 동기화 지원 (비로그인 시 로컬 스토리지 저장)
- **PWA (Progressive Web App)**:
  - 홈 화면에 추가 (Standalone 모드)
  - 서비스 워커 기반 정적 자산 오프라인 캐싱 (Supabase API 응답 제외)
  - iOS 노치 영역 대응 (`viewport-fit=cover`, `safe-area-inset` 적용)

---

## 🛠️ 로컬 개발 환경 실행 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
`.env` 파일에 아래 필수 환경변수를 설정합니다. (`.env.example` 참고)

```env
# Supabase 설정 (선택 사항: 미설정 시 로컬 저장소 모드로 작동)
VITE_SUPABASE_URL="https://your-supabase-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Gemini API (선택 사항)
GEMINI_API_KEY="your-gemini-api-key"

# 앱 호스팅 URL
APP_URL="http://localhost:3000"
```

### 3. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000`으로 접속합니다.

---

## 📦 빌드 및 배포 방법

### 1. 앱 빌드
```bash
npm run build
```
빌드 산출물은 `dist/` 디렉토리에 생성됩니다.

### 2. 프로덕션 실행
```bash
npm start
```

### 3. 클라우드 및 플랫폼 배포
- **Cloud Run / Docker**: `package.json`의 `start` 스크립트를 통해 Node.js 서버로 수신 포트 `3000`에 배포합니다.
- **Vercel / Netlify**: static SPA 배포가 가능하며, 빌드 명령어로 `npm run build`, 출력 디렉토리로 `dist`를 지정합니다.
