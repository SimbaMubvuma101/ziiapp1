
const API_BASE = '/api';

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async register(userData: { name: string; email: string; password: string; phone?: string; referralCode?: string; affiliateId?: string }) {
    return this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(email: string, password: string) {
    return this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getCurrentUser() {
    return this.request<any>('/auth/me');
  }

  // Predictions
  async getPredictions(filters: { status?: string; category?: string; country?: string; creatorId?: string; eventId?: string } = {}) {
    const params = new URLSearchParams(filters as any);
    return this.request<any[]>(`/predictions?${params}`);
  }

  async createPrediction(predictionData: any) {
    return this.request('/predictions', {
      method: 'POST',
      body: JSON.stringify(predictionData),
    });
  }

  async resolvePrediction(id: string, winning_option_id: string) {
    return this.request(`/predictions/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ winning_option_id }),
    });
  }

  // Entries
  async getEntries(status?: string) {
    const params = status ? `?status=${status}` : '';
    return this.request<any[]>(`/entries${params}`);
  }

  async placeEntry(entryData: { prediction_id: string; selected_option_id: string; amount: number }) {
    return this.request('/entries', {
      method: 'POST',
      body: JSON.stringify(entryData),
    });
  }

  // Wallet
  async getBalance() {
    return this.request<{ balance: number; winnings_balance: number }>('/wallet/balance');
  }

  async getTransactions() {
    return this.request<any[]>('/transactions');
  }

  async redeemVoucher(code: string) {
    return this.request('/wallet/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // Settings
  async getSettings() {
    return this.request('/settings');
  }

  async updateSettings(settings: any) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Admin
  async getAdminStats() {
    return this.request('/admin/stats');
  }
}

export const api = new ApiClient();
