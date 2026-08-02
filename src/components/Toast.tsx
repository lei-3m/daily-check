import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface ToastProps {
  toast: ToastState | null;
  onClose: () => void;
  duration?: number;
}

export interface ToastState {
  id: number;
  message: string;
}

export function Toast({ toast, onClose, duration = 1800 }: ToastProps) {
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast?.id, duration, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ease-out">
      <div className="bg-slate-900 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-full shadow-lg border border-slate-800 flex items-center gap-2 select-none">
        <span>{toast.message}</span>
      </div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextIdRef = useRef(1);

  const showToast = useCallback((message: string) => {
    setToast({
      id: nextIdRef.current++,
      message,
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    toast,
    showToast,
    hideToast,
  };
}
