/**
 * 붙여넣은 줄에서 마크다운 목록 표기를 걷어냅니다.
 * 다른 앱에서 `- [ ] 장보기`를 복사해 와도 본문만 남습니다.
 */
export function cleanTodoPrefix(line: string): string {
  let cleaned = line.trim();
  if (cleaned.startsWith('- [ ] ')) {
    cleaned = cleaned.slice(6);
  } else if (cleaned.startsWith('- [x] ') || cleaned.startsWith('- [X] ')) {
    cleaned = cleaned.slice(6);
  } else if (cleaned.startsWith('- [ ]')) {
    cleaned = cleaned.slice(5);
  } else if (cleaned.startsWith('- [x]') || cleaned.startsWith('- [X]')) {
    cleaned = cleaned.slice(5);
  } else if (cleaned.startsWith('- ')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('* ')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('-')) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith('*')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned.trim();
}
