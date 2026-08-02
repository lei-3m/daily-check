import { useState, useRef, useEffect } from 'react';
import { SyncStatus } from '../lib/storage';
import { ThemePreference } from '../lib/theme';

interface HeaderProps {
  dateLabel: string;
  completedCount: number;
  totalCount: number;
  userEmail?: string | null;
  syncStatus: SyncStatus;
  onSignOut: () => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
}

export function Header({
  dateLabel = '8월 1일 금요일',
  completedCount = 0,
  totalCount = 0,
  userEmail,
  syncStatus,
  onSignOut,
  themePreference,
  onThemePreferenceChange,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initialLetter = userEmail ? userEmail.charAt(0).toUpperCase() : 'U';
  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: 'light', label: '라이트' },
    { value: 'dark', label: '다크' },
    { value: 'system', label: '시스템 설정 따름' },
  ];

  const renderSyncBadge = () => {
    switch (syncStatus.type) {
      case 'saving':
        return (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            저장 중...
          </span>
        );
      case 'offline':
        return (
          <span className="flex items-center gap-1.5 text-xs text-rose-600 font-medium bg-rose-50 px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            오프라인
          </span>
        );
      case 'conflict':
        return (
          <span className="flex items-center gap-1.5 text-xs text-amber-700 font-medium bg-amber-100 px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            다른 기기에서 변경됨
          </span>
        );
      case 'synced':
        return (
          <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {syncStatus.lastSavedAt
              ? `동기화 완료 (${syncStatus.lastSavedAt})`
              : '동기화 완료'}
          </span>
        );
      case 'local_only':
      default:
        return (
          <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            로컬 저장
          </span>
        );
    }
  };

  return (
    <header className="border-b border-slate-100 pb-4 relative">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          오늘의 작업 공간
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full font-mono">
            {completedCount}/{totalCount}
          </span>

          {/* Account Profile button & Popover */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="계정 메뉴"
              className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer shadow-2xs"
            >
              {initialLetter}
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    연결된 계정
                  </div>
                  <div className="text-xs font-semibold text-slate-800 truncate mt-0.5">
                    {userEmail || '로그인 계정'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    동기화 상태
                  </div>
                  <div className="mt-1">{renderSyncBadge()}</div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    테마
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {themeOptions.map((option) => {
                      const isSelected = option.value === themePreference;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onThemePreferenceChange(option.value)}
                          aria-pressed={isSelected}
                          className={`w-full flex items-center justify-between text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
                            isSelected
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>{option.label}</span>
                          <span className={isSelected ? 'text-white' : 'text-slate-400'}>
                            {isSelected ? '✓' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500">{dateLabel}</p>
    </header>
  );
}
