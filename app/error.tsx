'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application runtime error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-neutral-50 text-neutral-800">
      <h2 className="text-2xl font-bold mb-3 text-neutral-900">系统遇到临时错误</h2>
      <p className="text-sm text-neutral-600 mb-6 max-w-md">
        抱歉，系统正在自动恢复中，请点击下方按钮重新加载或刷新页面。
      </p>
      <button
        onClick={() => reset()}
        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-medium rounded-xl transition-colors shadow-xs cursor-pointer"
      >
        重新尝试加载
      </button>
    </div>
  );
}
