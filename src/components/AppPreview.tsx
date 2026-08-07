import React from 'react';

/**
 * 로그인 화면에 보여줄 화면 미리보기.
 *
 * 실제 캡처 이미지가 아니라 같은 클래스로 그린 축소 모형입니다. 이미지 파일이면
 * 테마·강조색이 바뀌어도 따라오지 못하고, UI를 고칠 때마다 다시 찍어야 합니다.
 * 실제 스크린샷으로 바꾸려면 각 Mock을 <img>로 교체하면 됩니다.
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function MockFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="shrink-0 w-[140px] sm:w-auto snap-center">
      <div
        aria-hidden="true"
        className="h-[132px] bg-white border border-slate-200/80 rounded-xl p-2 overflow-hidden select-none"
      >
        {children}
      </div>
      <figcaption className="mt-1.5 text-[11px] font-medium text-slate-500 text-center">
        {label}
      </figcaption>
    </figure>
  );
}

function WeekMock() {
  // 수요일이 선택된 상태. 아래는 할 일 두 줄.
  return (
    <div className="space-y-1.5">
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg p-1">
        <div className="grid grid-cols-7 gap-px text-center">
          {WEEKDAYS.map((name, index) => (
            <div
              key={name}
              className={`text-[6px] font-semibold ${
                index === 0 ? 'text-red-500/80' : index === 6 ? 'text-blue-500/80' : 'text-slate-400'
              }`}
            >
              {name}
            </div>
          ))}
          {[8, 9, 10, 11, 12, 13, 14].map((day) => (
            <div
              key={day}
              className={`text-[7px] font-mono rounded-[3px] py-0.5 ${
                day === 11
                  ? 'calendar-day-selected bg-slate-900 text-white font-bold'
                  : 'text-slate-600'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {[
          { text: '보고서 초안', done: true },
          { text: '장보기 목록', done: false },
          { text: '운동 30분', done: false },
        ].map((todo) => (
          <div key={todo.text} className="flex items-center gap-1">
            <span className="text-slate-300 text-[6px]">⠿</span>
            <span
              className={`w-2 h-2 rounded-[2px] border shrink-0 ${
                todo.done ? 'accent-fill' : 'bg-white border-slate-300'
              }`}
            />
            <span
              className={`text-[7px] truncate ${
                todo.done ? 'line-through text-slate-400' : 'text-slate-700'
              }`}
            >
              {todo.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthMock() {
  const days = Array.from({ length: 35 }, (_, index) => index - 2);
  return (
    <div className="space-y-1">
      <div className="text-[7px] font-bold text-slate-800 text-center">2026년 8월</div>
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((name, index) => (
          <div
            key={name}
            className={`text-[6px] font-semibold text-center ${
              index === 0 ? 'text-red-500/80' : index === 6 ? 'text-blue-500/80' : 'text-slate-400'
            }`}
          >
            {name}
          </div>
        ))}
        {days.map((day, index) => {
          const isOtherMonth = day < 1 || day > 31;
          const isSelected = day === 11;
          return (
            <div
              key={index}
              className={`h-3 rounded-[2px] flex items-start justify-center pt-px text-[6px] font-mono ${
                isSelected
                  ? 'calendar-day-selected bg-slate-900 text-white font-bold'
                  : isOtherMonth
                  ? 'calendar-other-month'
                  : 'calendar-cell-surface border border-slate-100 text-slate-600'
              }`}
            >
              {isOtherMonth ? '' : day}
              {!isSelected && !isOtherMonth && day % 5 === 0 && (
                <span className="ml-px accent-text text-[5px] leading-none">●</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriorityMock() {
  // PrioritySuggestionModal의 축소판. 번호와 이유, 그리고 [순서 적용] 버튼.
  return (
    <div className="space-y-1.5">
      <div className="inline-flex items-center gap-1 accent-soft accent-text rounded px-1 py-px text-[6px] font-bold">
        <span>✨</span>
        <span>AI 순서 제안</span>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-md p-1 space-y-1">
        {[
          { text: '보고서 초안', reason: '오늘 마감' },
          { text: '운동 30분', reason: '일정 사이 여유' },
          { text: '장보기 목록', reason: '퇴근길에' },
        ].map((item, index) => (
          <div key={item.text} className="flex gap-1">
            <span className="text-[6px] font-bold text-slate-500 shrink-0">{index + 1}.</span>
            <div className="min-w-0">
              <div className="text-[6px] font-semibold text-slate-800 truncate">{item.text}</div>
              <div className="text-[5px] text-slate-500 truncate">{item.reason}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className="accent-fill text-white rounded text-[6px] font-semibold text-center py-0.5">
          순서 적용
        </div>
        <div className="bg-slate-100 text-slate-600 rounded text-[6px] font-semibold text-center py-0.5">
          취소
        </div>
      </div>
    </div>
  );
}

function CopyMock() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-center gap-1 bg-slate-100 rounded-md py-1">
        <span className="text-[8px]">📋</span>
        <span className="text-[7px] font-semibold text-slate-600">복사</span>
      </div>
      <div className="bg-slate-900 rounded-md p-1.5 space-y-1">
        {['- [x] 보고서 초안', '- [ ] 장보기 목록', '- [ ] 운동 30분'].map((line) => (
          <div key={line} className="text-[6px] font-mono text-slate-300 truncate">
            {line}
          </div>
        ))}
      </div>
      <div className="text-[6px] text-slate-400 text-center leading-relaxed">
        붙여넣으면 그대로 체크리스트
      </div>
    </div>
  );
}

export function AppPreview() {
  return (
    // 폰에서는 가로로 넘겨 본다.
    // 넓은 화면에서 넷을 한 줄에 놓으면 카드 폭(400px) 안에서 한 장이 92px까지
    // 줄어 아무것도 읽히지 않는다. 2x2로 놓아 오히려 크게 보여준다.
    <div className="-mx-2 px-2 flex gap-2.5 overflow-x-auto snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:overflow-visible">
      <MockFrame label="주간 뷰">
        <WeekMock />
      </MockFrame>
      <MockFrame label="AI 순서 제안">
        <PriorityMock />
      </MockFrame>
      <MockFrame label="월 달력">
        <MonthMock />
      </MockFrame>
      <MockFrame label="복사">
        <CopyMock />
      </MockFrame>
    </div>
  );
}
