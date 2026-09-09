import { getAllDishes, getSettings, getAllTables } from '@/lib/db';
import OrderingClient from '@/components/OrderingClient';
import { Dish, AppSettings, DiningTable } from '@/types';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ desk?: string; tenant?: string; t?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const initialDesk = resolvedParams?.desk || '';
  const initialTenant = resolvedParams?.tenant || resolvedParams?.t || 'default';

  let initialDishes: Dish[] = [];
  let initialSettings: AppSettings | null = null;
  let initialTables: DiningTable[] = [];
  try {
    const [dishes, settings, tables] = await Promise.all([
      getAllDishes(true, initialTenant),
      getSettings(initialTenant),
      getAllTables(false, initialTenant),
    ]);
    initialDishes = dishes;
    initialSettings = settings;
    initialTables = tables;
  } catch (err) {
    console.error('Failed to load initial dishes or settings:', err);
  }

  return (
    <OrderingClient
      initialDishes={initialDishes}
      initialDesk={initialDesk}
      initialSettings={initialSettings}
      initialTables={initialTables}
      initialTenantId={initialTenant}
    />
  );
}
