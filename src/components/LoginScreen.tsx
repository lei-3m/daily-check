import React, { useState } from 'react';
import { CalendarDays, ClipboardCheck, RefreshCw, Inbox, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AppPreview } from './AppPreview';

// 매일 보는 화면부터 시작해 AI, 복사, 서랍, 동기화 순으로 넓혀 간다.
const FEATURES = [
  {
    Icon: CalendarDays,
    text: '날짜별 할 일과 메모, 다가오는 일정을 한 화면에서 봅니다',
  },
  {
    Icon: Sparkles,
    text: '할 일 순서를 AI가 제안합니다. 메모와 일정까지 참고합니다',
  },
  {
    Icon: ClipboardCheck,
    text: '남은 일을 마크다운으로 복사해 AI에 그대로 붙여넣습니다',
  },
  {
    Icon: Inbox,
    text: '살 것, 읽을 것처럼 날짜와 무관한 목록은 서랍에 둡니다',
  },
  {
    Icon: RefreshCw,
    text: 'PC와 폰에서 같은 내용을 보고, 오프라인에서도 열립니다',
  },
];

export function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured()) {
      setErrorMessage(
        'Supabase 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 설정되지 않았습니다.'
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로그인 요청 중 오류가 발생했습니다.';
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 text-center space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl accent-fill text-white font-bold text-xl shadow-xs">
            ✓
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            오늘의 작업 공간
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            남은 일을 복사해 AI에 붙여넣는 하루 단위 체크리스트
          </p>
        </div>

        <AppPreview />

        <ul className="space-y-2 text-left">
          {FEATURES.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5">
              <Icon
                size={16}
                strokeWidth={2}
                aria-hidden="true"
                className="shrink-0 mt-0.5 text-slate-400"
              />
              <span className="text-xs text-slate-600 leading-relaxed">{text}</span>
            </li>
          ))}
        </ul>

        {errorMessage && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg text-left">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-semibold py-2.5 px-4 rounded-xl shadow-2xs hover:shadow-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-60 cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? '로그인 진행 중...' : 'Google로 계속하기'}</span>
        </button>

        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
          Google 계정으로 로그인하면 PC와 폰에서 같은 내용을 봅니다.
        </div>
      </div>
    </div>
  );
}
