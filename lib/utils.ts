import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 安全解析 fetch 返回的 JSON 数据，彻底防止 HTML 错误页（如 404/500/网关超时以 '<' 开头）导致 Uncaught SyntaxError: Unexpected token '<'
 */
export async function parseJsonResponse<T = any>(res: Response, fallback?: T): Promise<T> {
  try {
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      console.warn('[SafeJSON] Response is not JSON:', trimmed.slice(0, 100));
      return (fallback ?? { success: false, error: '服务返回非JSON数据: ' + (trimmed.slice(0, 80) || '空数据') }) as T;
    }
    return JSON.parse(trimmed) as T;
  } catch (err: any) {
    console.warn('[SafeJSON] JSON parse failed:', err);
    return (fallback ?? { success: false, error: '解析响应数据失败' }) as T;
  }
}
