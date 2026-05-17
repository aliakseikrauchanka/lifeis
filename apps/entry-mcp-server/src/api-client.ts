type AppId = 'logs' | 'training';

export class ApiClient {
  constructor(
    private baseUrl: string,
    private accessToken: string,
  ) {}

  private async request(app: AppId, method: string, path: string, body?: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'x-app-id': app,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        `API ${method} ${path} failed (${res.status}): ${(err as { message?: string }).message || res.statusText}`,
      );
    }
    return res.json();
  }

  createLog(message: string, basket_id?: string) {
    return this.request('logs', 'POST', '/api/logs', { message, basket_id });
  }

  listLogs(from?: string, to?: string, basket_id?: string) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (basket_id) params.set('basket_id', basket_id);
    const qs = params.toString();
    return this.request('logs', 'GET', `/api/logs${qs ? `?${qs}` : ''}`);
  }

  updateLog(id: string, message: string, basket_id?: string) {
    return this.request('logs', 'PATCH', `/api/logs/${id}`, { message, basket_id });
  }

  deleteLog(id: string) {
    return this.request('logs', 'DELETE', `/api/logs/${id}`);
  }

  trainedToday(since: number) {
    return this.request('training', 'GET', `/api/srs/trained-today?since=${since}`);
  }

  addedSince(since: number) {
    return this.request('training', 'GET', `/api/translations/added-since?since=${since}`);
  }

  createTranslation(
    original: string,
    translation: string,
    originalLanguage: string,
    translationLanguage: string,
  ) {
    return this.request('training', 'POST', '/api/translations', {
      original,
      translation,
      originalLanguage,
      translationLanguage,
    });
  }
}
