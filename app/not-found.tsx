import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-neutral-50 text-neutral-800">
      <h2 className="text-4xl font-bold mb-3 text-neutral-900">404</h2>
      <p className="text-base text-neutral-600 mb-6">您访问的页面不存在或已被移除</p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-medium rounded-xl transition-colors shadow-xs"
      >
        返回点餐首页
      </Link>
    </div>
  );
}
