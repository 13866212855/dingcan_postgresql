import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: '小饭店点餐系统 - 手机点餐与后台管理',
  description: '基于SQLite的手机H5小饭店扫码点餐与/admin后台管理系统',
  openGraph: {
    title: '小饭店点餐系统 - 手机点餐与后台管理',
    description: '基于SQLite的手机H5小饭店扫码点餐与/admin后台管理系统',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '小饭店点餐系统 - 手机点餐与后台管理',
    description: '基于SQLite的手机H5小饭店扫码点餐与/admin后台管理系统',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning className="bg-neutral-50 text-neutral-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
