import { useState, useRef, useEffect } from 'react';
import { SyncStatus } from '../lib/storage';
import { ACCENT_OPTIONS, AccentPreference, ThemePreference } from '../lib/theme';

interface HeaderProps {
  dateLabel: string;
  completedCount: number;
  totalCount: number;
  userEmail?: string | null;
  syncStatus: SyncStatus;
  onSignOut: () => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  accentPreference: AccentPreference;
  onAccentPreferenceChange: (preference: AccentPreference) => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  includeMemoInPriority: boolean;
  onIncludeMemoInPriorityChange: (includeMemo: boolean) => void;
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
  accentPreference,
  onAccentPreferenceChange,
  onExportData,
  onImportData,
  includeMemoInPriority,
  onIncludeMemoInPriorityChange,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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
      case 'pending':
        return (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            동기화 대기 중
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
            동기화됨
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
                              ? 'accent-fill text-white'
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

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    강조 색상
                  </div>
                  <div className="grid grid-cols-4 justify-start gap-0">
                    {ACCENT_OPTIONS.map((option) => {
                      const isSelected = option.value === accentPreference;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onAccentPreferenceChange(option.value)}
                          aria-label={`${option.label} 강조 색상`}
                          aria-pressed={isSelected}
                          className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                        >
                          <span
                            className={`w-4 h-4 rounded-full ${
                              isSelected ? 'ring-2 ring-slate-900 ring-offset-2' : ''
                            }`}
                            style={{ backgroundColor: option.swatch }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    우선순위
                  </div>
                  <label className="min-h-11 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100">
                    <span>메모도 함께 보내기</span>
                    <span className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={includeMemoInPriority}
                        onChange={(event) =>
                          onIncludeMemoInPriorityChange(event.target.checked)
                        }
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`w-4 h-4 rounded border flex items-center justify-center text-[11px] leading-none font-bold ${
                          includeMemoInPriority
                            ? 'accent-fill text-white'
                            : 'bg-white border-slate-300 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                    </span>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    데이터 백업
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onExportData();
                      }}
                      className="w-full text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    >
                      데이터 내보내기
                    </button>
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      className="w-full text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    >
                      데이터 가져오기
                    </button>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        setIsMenuOpen(false);
                        onImportData(file);
                      }}
                    />
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
