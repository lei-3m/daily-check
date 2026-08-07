import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

// 세로 목록 정렬용 공통 설정. 할 일 목록과 서랍 목록이 같은 감각으로 움직여야 한다.
// 손잡이를 200ms 길게 누른 뒤 드래그, 좌우 이동 없음, 목록 컨테이너 밖으로 못 나감.
export const restrictDragToList: Modifier = ({
  transform,
  activeNodeRect,
  containerNodeRect,
}) => {
  const nextTransform = { ...transform, x: 0 };

  if (!activeNodeRect || !containerNodeRect) {
    return nextTransform;
  }

  const minY = containerNodeRect.top - activeNodeRect.top;
  const maxY = containerNodeRect.bottom - activeNodeRect.bottom;

  return {
    ...nextTransform,
    y: Math.min(Math.max(nextTransform.y, minY), maxY),
  };
};

export function useListDragSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}
