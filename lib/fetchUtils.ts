/**
 * Resilient JSON fetch utility with automatic retries, abort signal handling,
 * and error insulation to prevent unhandled 'Failed to fetch' exceptions in browser environments.
 */

export interface SafeFetchOptions extends RequestInit {
  retries?: number;
  backoffMs?: number;
}

export async function safeFetchJson<T>(
  url: string,
  options?: SafeFetchOptions
): Promise<T | null> {
  const { retries = 2, backoffMs = 300, signal, ...restInit } = options || {};

  for (let attempt = 0; attempt <= retries; attempt++) {
    // If signal already aborted before starting, exit cleanly
    if (signal?.aborted) {
      return null;
    }

    try {
      const res = await fetch(url, {
        ...restInit,
        signal,
        headers: {
          Accept: 'application/json',
          ...(restInit.headers || {}),
        },
      });

      if (!res.ok) {
        // If 4xx client error (e.g. 404, 400), don't retry as the resource/request is invalid
        if (res.status >= 400 && res.status < 500) {
          return null;
        }
        // 5xx server error: retry if attempts left
        if (attempt < retries && !signal?.aborted) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
          continue;
        }
        return null;
      }

      // Check if response is valid JSON
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return null;
      }

      const data = await res.json();
      return data as T;
    } catch (err: any) {
      // Aborted by caller (e.g. component unmount or URL navigation)
      if (err?.name === 'AbortError' || signal?.aborted) {
        return null;
      }

      // Network or transient connection error: retry if attempts remaining
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
        continue;
      }

      // After exhausting retries, log a non-fatal warning
      console.warn(`[safeFetchJson] Request to ${url} did not succeed:`, err?.message || err);
      return null;
    }
  }

  return null;
}
