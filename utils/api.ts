
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

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const contentType = response.headers.get('content-type');
      
      // Check if response is JSON
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `Request failed with status ${response.status}`);
        }
        
        return data;
      } else {
        // Handle non-JSON responses
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
      }
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Network error - please check your connection');
    }
  }

  // Auth
  async register(userData: { 
    name: string; 
    email: string; 
    password: string; 
    phone?: string; 
    referralCode?: string; 
    affiliateId?: string;
    country?: string;
  }) {
    try {
      console.log('Registering user:', userData.email);
      const response = await this.request<{ token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      this.setToken(response.token);
      return response;
    } catch (err) {
      console.error('Registration API error:', err);
      throw err;
    }
  }

  async login(email: string, password: string) {
    const response = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(response.token);
    return response;
  }

  async getCurrentUser() {
    return this.request<any>('/auth/me');
  }

  async updateProfile(updates: { name?: string; phone?: string; country?: string }) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Predictions
  async getPredictions(filters: { 
    status?: string; 
    category?: string; 
    country?: string; 
    creatorId?: string; 
    eventId?: string;
  } = {}) {
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

  async placeEntry(entryData: { 
    prediction_id: string; 
    selected_option_id: string; 
    amount: number;
  }) {
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

  async createVoucher(amount: number) {
    return this.request<{ code: string; amount: number }>('/admin/vouchers', {
      method: 'POST',
      body: JSON.stringify({ amount }),
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

  async getAnalytics() {
    return this.request('/admin/analytics');
  }

  async getAffiliates() {
    return this.request<any[]>('/admin/affiliates');
  }

  async createAffiliate(data: { name: string; code: string }) {
    return this.request('/admin/affiliates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCreatorInvites() {
    return this.request<any[]>('/admin/creator-invites');
  }

  async createCreatorInvite(data: { name: string; country: string }) {
    return this.request('/admin/creator-invites', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeCreatorInvite(inviteId: string) {
    return this.request(`/admin/creator-invites/${inviteId}/revoke`, {
      method: 'POST',
    });
  }

  async validateCreatorInvite(code: string) {
    return this.request(`/creator-invites/validate/${code}`);
  }

  async claimCreatorInvite(code: string) {
    return this.request('/creator-invites/claim', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // Stripe/Payment endpoints
  async createCheckoutSession(amount: number) {
    return this.request<{ url: string }>('/stripe/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async requestCashout(data: { amount: number; phone: string; method: string }) {
    return this.request('/wallet/cashout', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
