import { NextRequest } from 'next/server';

export const DEFAULT_TENANT_ID = 'default';

/**
 * Normalizes a tenant identifier string
 */
export function normalizeTenantId(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return DEFAULT_TENANT_ID;
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return clean || DEFAULT_TENANT_ID;
}

/**
 * Extracts the tenant ID from Next.js server requests.
 * Checks in sequence:
 * 1. Query parameter (?tenant=xxx or ?t=xxx)
 * 2. Header (x-tenant-id)
 * 3. Cookie (dingcan_tenant_id)
 * 4. Fallback to 'default'
 */
export function getTenantIdFromRequest(req: NextRequest): string {
  // 1. Query parameter
  const queryTenant = req.nextUrl.searchParams.get('tenant') || req.nextUrl.searchParams.get('t');
  if (queryTenant && queryTenant.trim()) {
    return normalizeTenantId(queryTenant);
  }

  // 2. Request header (useful for API proxies, Nginx subpaths, or custom clients)
  const headerTenant = req.headers.get('x-tenant-id');
  if (headerTenant && headerTenant.trim()) {
    return normalizeTenantId(headerTenant);
  }

  // 3. Cookie (useful for persistent browser session across page reloads)
  const cookieTenant = req.cookies.get('dingcan_tenant_id')?.value;
  if (cookieTenant && cookieTenant.trim()) {
    return normalizeTenantId(cookieTenant);
  }

  return DEFAULT_TENANT_ID;
}
