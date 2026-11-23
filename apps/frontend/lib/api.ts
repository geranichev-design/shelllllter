const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem('shelter-auth');
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(
        'Запит до API зависнув. Перевірте, чи backend та база даних відповідають.',
        0
      );
    }

    throw new ApiError(
      'Не вдалося зв’язатися з API. Перевірте, чи запущені backend та база даних.',
      0
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = (await response.json()) as { message?: string | string[] };
      const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      if (response.status === 403) {
        throw new ApiError(message || 'Недостатньо прав для виконання цієї дії', response.status);
      }
      throw new ApiError(message || `Request failed with status ${response.status}`, response.status);
    }

    const message = await response.text();
    if (response.status === 403) {
      throw new ApiError(message || 'Недостатньо прав для виконання цієї дії', response.status);
    }
    throw new ApiError(message || `Request failed with status ${response.status}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
