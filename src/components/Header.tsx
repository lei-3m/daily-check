import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { SyncStatus } from '../lib/storage';
import { ACCENT_OPTIONS, AccentPreference, ThemePreference } from '../lib/theme';

export interface AccountProfile {
  displayName: string;
  googleName: string;
  email?: string | null;
  avatarEmoji?: string | null;
  avatarUrl?: string | null;
}

export interface AccountProfileUpdate {
  displayName?: string | null;
  avatarEmoji?: string | null;
}

interface HeaderProps {
  dateLabel: string;
  completedCount: number;
  totalCount: number;
  profile: AccountProfile;
  syncStatus: SyncStatus;
  onSignOut: () => void;
  isSigningOut: boolean;
  onUpdateProfile: (update: AccountProfileUpdate) => Promise<boolean>;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  accentPreference: AccentPreference;
  onAccentPreferenceChange: (preference: AccentPreference) => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  includeMemoInPriority: boolean;
  onIncludeMemoInPriorityChange: (includeMemo: boolean) => void;
}

const AVATAR_EMOJIS = [
  '🙂',
  '😊',
  '😎',
  '🤓',
  '🫡',
  '🌿',
  '🌙',
  '☀️',
  '⭐',
  '✨',
  '🌟',
  '🔥',
  '💧',
  '🍀',
  '🍋',
  '☕',
  '📘',
  '✏️',
  '✅',
  '🎯',
  '💡',
  '🧭',
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🖤',
  '🤍',
  '🩷',
  '💗',
  '💖',
  '💕',
  '💎',
  '💍',
  '🔮',
];

export function Header({
  dateLabel,
  completedCount = 0,
  totalCount = 0,
  profile,
  syncStatus,
  onSignOut,
  isSigningOut,
  onUpdateProfile,
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
  const [menuView, setMenuView] = useState<'main' | 'profile'>('main');
  const [draftName, setDraftName] = useState(profile.displayName);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileNameInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const isSigningOutRef = useRef(isSigningOut);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      // 동기화 중에는 메뉴를 열어 두어야 진행 상태가 보입니다.
      if (isSigningOutRef.current) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
        setMenuView('main');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const wasSigningOut = isSigningOutRef.current;
    isSigningOutRef.current = isSigningOut;
    // 시도가 끝나면 메뉴를 닫습니다. 실패하면 경고 모달이 이어받습니다.
    if (wasSigningOut && !isSigningOut) {
      setIsMenuOpen(false);
      setMenuView('main');
    }
  }, [isSigningOut]);

  useEffect(() => {
    setDraftName(profile.displayName);
  }, [profile.displayName]);

  useEffect(() => {
    if (isMenuOpen && menuView === 'profile') {
      window.setTimeout(() => {
        profileNameInputRef.current?.focus();
        profileNameInputRef.current?.select();
      }, 0);
    }
  }, [isMenuOpen, menuView]);

  const initialLetter =
    profile.displayName.trim().charAt(0).toUpperCase() ||
    profile.email?.charAt(0).toUpperCase() ||
    'U';

  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: 'light', label: '라이트' },
    { value: 'dark', label: '다크' },
    { value: 'system', label: '시스템 설정 따름' },
  ];

  const renderAvatar = (sizeClass: string) => {
    if (profile.avatarEmoji) {
      return (
        <span className={`${sizeClass} flex items-center justify-center text-base leading-none`}>
          {profile.avatarEmoji}
        </span>
      );
    }

    if (profile.avatarUrl) {
      return (
        <img
          src={profile.avatarUrl}
          alt=""
          className={`${sizeClass} rounded-full object-cover`}
          referrerPolicy="no-referrer"
        />
      );
    }

    return (
      <span className={`${sizeClass} flex items-center justify-center text-xs font-bold`}>
        {initialLetter}
      </span>
    );
  };

  const saveDisplayName = async () => {
    const trimmed = draftName.trim();
    if (trimmed === profile.displayName.trim()) return;

    setIsSavingProfile(true);
    const saved = await onUpdateProfile({ displayName: trimmed || null });
    setIsSavingProfile(false);
    if (!saved) {
      setDraftName(profile.displayName);
    }
  };

  const updateAvatarEmoji = async (avatarEmoji: string | null) => {
    if ((profile.avatarEmoji || null) === avatarEmoji) return;

    setIsSavingProfile(true);
    await onUpdateProfile({ avatarEmoji });
    setIsSavingProfile(false);
  };

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

  const renderProfileView = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <button
          type="button"
          onClick={() => setMenuView('main')}
          aria-label="뒤로"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">프로필 설정</div>
          <div className="text-xs text-slate-500 truncate">
            {profile.email || '로그인 계정'}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="account-display-name"
          className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
        >
          표시 이름
        </label>
        <input
          id="account-display-name"
          ref={profileNameInputRef}
          type="text"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={saveDisplayName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setDraftName(profile.displayName);
              event.currentTarget.blur();
            }
          }}
          enterKeyHint="done"
          placeholder={profile.googleName || '표시 이름'}
          disabled={isSavingProfile}
          className="w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-60"
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          아바타
        </div>
        <div className="grid grid-cols-4 gap-0 max-h-60 overflow-y-auto pr-1">
          {AVATAR_EMOJIS.map((emoji) => {
            const isSelected = profile.avatarEmoji === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => updateAvatarEmoji(emoji)}
                aria-label={`${emoji} 아바타 선택`}
                aria-pressed={isSelected}
                disabled={isSavingProfile}
                className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg text-xl hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-60"
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isSelected ? 'ring-2 ring-slate-900 ring-offset-2' : ''
                  }`}
                >
                  {emoji}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => updateAvatarEmoji(null)}
          disabled={isSavingProfile || !profile.avatarEmoji}
          className="w-full min-h-11 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent"
        >
          기본값으로 되돌리기
        </button>
      </div>
    </div>
  );

  const renderMainMenu = () => (
    <>
      <div className="border-b border-slate-100 pb-2">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          계정
        </div>
        <button
          type="button"
          onClick={() => setMenuView('profile')}
          className="mt-1 w-full min-h-11 flex items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <span className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center overflow-hidden shrink-0">
            {renderAvatar('w-9 h-9')}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-slate-800 truncate">
              {profile.displayName || profile.email || '로그인 계정'}
            </span>
            <span className="block text-[11px] text-slate-500 truncate">프로필 설정</span>
          </span>
        </button>
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
                className={`w-full min-h-11 flex items-center justify-between text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
                  isSelected ? 'accent-fill text-white' : 'text-slate-600 hover:bg-slate-100'
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
          AI 순서 제안
        </div>
        <label className="min-h-11 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100">
          <span>메모도 함께 보내기</span>
          <span className="relative flex items-center justify-center">
            <input
              type="checkbox"
              checked={includeMemoInPriority}
              onChange={(event) => onIncludeMemoInPriorityChange(event.target.checked)}
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
            className="w-full min-h-11 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            데이터 내보내기
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="w-full min-h-11 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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
          onClick={onSignOut}
          disabled={isSigningOut}
          aria-busy={isSigningOut}
          className="w-full min-h-11 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:pointer-events-none disabled:text-slate-500"
        >
          {isSigningOut ? '동기화 중…' : '로그아웃'}
        </button>
      </div>
    </>
  );

  return (
    <header className="border-b border-slate-100 pb-4 relative">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">오늘의 작업 공간</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full font-mono">
            {completedCount}/{totalCount}
          </span>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen((prev) => !prev);
                setMenuView('main');
              }}
              aria-label="계정 메뉴"
              className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center overflow-hidden transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer shadow-2xs"
            >
              {renderAvatar('w-8 h-8')}
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 space-y-3">
                {menuView === 'profile' ? renderProfileView() : renderMainMenu()}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500">{dateLabel}</p>
    </header>
  );
}
