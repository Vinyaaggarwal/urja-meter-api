import {
  ApiResponse,
  ConsumptionReading,
  HealthStatus,
  Meter,
  MeterComposite,
  MeterNetwork,
  PaginationMeta,
  Transformer,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

class ApiService {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
    const startTime = performance.now();

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      const durationMs = Math.round(performance.now() - startTime);

      if (!response.ok) {
        let errMessage = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMessage = errData.error;
          }
        } catch {
          // not json
        }
        const error = new Error(errMessage) as Error & { statusCode: number; durationMs: number };
        error.statusCode = response.status;
        error.durationMs = durationMs;
        throw error;
      }

      return await response.json();
    } catch (err: any) {
      if (!err.statusCode) {
        err.durationMs = Math.round(performance.now() - startTime);
        err.statusCode = 0; // Network connection failure
        err.message = err.message || 'Failed to connect to backend API server. Make sure the backend is running.';
      }
      throw err;
    }
  }

  async checkHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  async getMeters(params: { q?: string; page?: number } = {}): Promise<ApiResponse<Meter[], PaginationMeta>> {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.page) query.set('page', String(params.page));
    const qs = query.toString();
    return this.request<ApiResponse<Meter[], PaginationMeta>>(`/api/meters${qs ? `?${qs}` : ''}`);
  }

  async getMeterDetails(meterId: string): Promise<ApiResponse<MeterComposite>> {
    return this.request<ApiResponse<MeterComposite>>(`/api/meters/${encodeURIComponent(meterId)}`);
  }

  async getMeterConsumption(
    meterId: string
  ): Promise<ApiResponse<ConsumptionReading[], { meterId: string; count: number; unit: string }>> {
    return this.request<ApiResponse<ConsumptionReading[], { meterId: string; count: number; unit: string }>>(
      `/api/meters/${encodeURIComponent(meterId)}/consumption`
    );
  }

  async getMeterNetwork(meterId: string): Promise<ApiResponse<MeterNetwork>> {
    return this.request<ApiResponse<MeterNetwork>>(`/api/meters/${encodeURIComponent(meterId)}/network`);
  }

  async getTransformers(page = 1): Promise<ApiResponse<Transformer[], { page: number; count: number }>> {
    return this.request<ApiResponse<Transformer[], { page: number; count: number }>>(`/api/transformers?page=${page}`);
  }

  async getExport(page = 1): Promise<ApiResponse<any[], { page: number; count: number; authenticated: boolean }>> {
    return this.request<ApiResponse<any[], { page: number; count: number; authenticated: boolean }>>(`/api/export?page=${page}`);
  }

  // Raw execution for API Explorer
  async executeRaw(path: string): Promise<{
    status: number;
    statusText: string;
    durationMs: number;
    ok: boolean;
    data: any;
  }> {
    const url = `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
    const startTime = performance.now();

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      const durationMs = Math.round(performance.now() - startTime);
      let data: any;
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }
      return {
        status: response.status,
        statusText: response.statusText,
        durationMs,
        ok: response.ok,
        data,
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      return {
        status: 0,
        statusText: 'Network Error',
        durationMs,
        ok: false,
        data: { error: err.message || 'Connection refused' },
      };
    }
  }
}

export const api = new ApiService();

