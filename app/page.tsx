import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getAllDishes, getSettings, getAllTables, getTenantById } from '@/lib/db';
import OrderingClient from '@/components/OrderingClient';
import { Dish, AppSettings, DiningTable } from '@/types';

export const dynamic = 'force-dynamic';

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ desk?: string; tenant?: string; t?: string }>;
}): Promise<Metadata> {
  const resolvedParams = searchParams ? await searchParams : {};
  const tenantId = (resolvedParams?.tenant || resolvedParams?.t || 'default').trim();

  let tenantName = tenantId === 'zhou' ? '康乐美' : '客来香·家常菜馆';
  let tenantSlogan = '精选食材 · 匠心出品 · 扫码在线点餐';
  let tenantLogo = '';

  try {
    const [settings, tenant] = await Promise.all([
      withTimeout(getSettings(tenantId), 3000, null),
      withTimeout(getTenantById(tenantId), 3000, null),
    ]);
    if (settings?.restaurant_name?.trim()) {
      tenantName = settings.restaurant_name.trim();
    } else if (tenant?.name?.trim()) {
      tenantName = tenant.name.trim();
    }

    if (settings?.restaurant_slogan?.trim()) {
      tenantSlogan = settings.restaurant_slogan.trim();
    } else if (tenant?.slogan?.trim()) {
      tenantSlogan = tenant.slogan.trim();
    }

    tenantLogo = settings?.restaurant_logo?.trim() || tenant?.logo?.trim() || '';
  } catch (err) {
    console.error('Failed to load tenant metadata for WeChat card:', err);
  }

  // Determine base URL dynamically from request headers
  let baseUrl = 'https://dingcan-postgresql.onrender.com';
  try {
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host');
    const proto = headersList.get('x-forwarded-proto') || 'https';
    if (host) {
      baseUrl = `${proto}://${host}`;
    }
  } catch {
    // Keep fallback baseUrl
  }

  // Ensure absolute image URL for WeChat crawler compatibility
  let absoluteLogoUrl = tenantLogo;
  if (!absoluteLogoUrl) {
    absoluteLogoUrl = `${baseUrl}/uploads/dishes/u_a0065f1c4661.jpg`;
  } else if (absoluteLogoUrl.startsWith('/')) {
    absoluteLogoUrl = `${baseUrl}${absoluteLogoUrl}`;
  }

  const pageTitle = `${tenantName}订餐系统`;
  const pageDescription = `${tenantSlogan}。美味佳肴现点现做，支持在线选菜、积分抵扣与微信支付。`;
  const canonicalUrl = `${baseUrl}/?tenant=${encodeURIComponent(tenantId)}`;

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: canonicalUrl,
      siteName: `${tenantName}订餐系统`,
      locale: 'zh_CN',
      type: 'website',
      images: [
        {
          url: absoluteLogoUrl,
          width: 500,
          height: 500,
          alt: `${tenantName}专属标志`,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title: pageTitle,
      description: pageDescription,
      images: [absoluteLogoUrl],
    },
    other: {
      'og:image:secure_url': absoluteLogoUrl,
      'apple-mobile-web-app-title': pageTitle,
    },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ desk?: string; tenant?: string; t?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const initialDesk = resolvedParams?.desk || '';
  const initialTenant = (resolvedParams?.tenant || resolvedParams?.t || 'default').trim();

  let initialDishes: Dish[] = [];
  let initialSettings: AppSettings | null = null;
  let initialTables: DiningTable[] = [];
  try {
    const [dishes, settings, tables] = await Promise.all([
      withTimeout(getAllDishes(true, initialTenant), 4500, []),
      withTimeout(getSettings(initialTenant), 4500, null),
      withTimeout(getAllTables(false, initialTenant), 4500, []),
    ]);
    initialDishes = dishes;
    initialSettings = settings;
    initialTables = tables;
  } catch (err) {
    console.error('Failed to load initial dishes or settings:', err);
  }

  // Derive absolute logo for hidden first image in body (fallback for older WeChat crawlers)
  const tenantName = initialSettings?.restaurant_name?.trim() || (initialTenant === 'zhou' ? '康乐美' : '客来香·家常菜馆');
  let fallbackLogo = initialSettings?.restaurant_logo?.trim() || '/uploads/dishes/u_a0065f1c4661.jpg';
  if (!fallbackLogo.startsWith('http') && !fallbackLogo.startsWith('/')) {
    fallbackLogo = `/${fallbackLogo}`;
  }

  return (
    <>
      {/* 微信内置浏览器分享首图兼容占位（微信特定版本抓取第一张非隐藏或隐藏顶置img） */}
      <div style={{ display: 'none' }} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fallbackLogo}
          alt={tenantName}
          width={300}
          height={300}
        />
      </div>

      <OrderingClient
        initialDishes={initialDishes}
        initialDesk={initialDesk}
        initialSettings={initialSettings}
        initialTables={initialTables}
        initialTenantId={initialTenant}
      />
    </>
  );
}
