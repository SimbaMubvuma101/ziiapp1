// utils/api.ts

// Detect environment
const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
const isReplitDomain = hostname.includes('.replit.dev') || hostname.includes('.repl.co');

console.log('🔍 Environment Detection:', {
  hostname,
  isLocalhost,
  isReplitDomain,
  timestamp: new Date().toISOString()
});

// API base resolution
const API_BASE_URL = (isLocalhost && !isReplitDomain)
  ? 'http://localhost:5000'
  : '';

console.log('API Configuration:', {
  hostname,
  isLocalhost,
  isReplitDomain,
  apiBase: API_BASE_URL,
  fullUrl: API_BASE_URL || window.location.origin
});

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}/api${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const getAuthToken = () => {
    const token =
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token');

    console.log('🔑 Auth Token Retrieved:', token ? 'Present' : 'Missing');
    return token;
  };

  const token = getAuthToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  if (options.method === 'POST' && options.body) {
    console.log('📤 API Request:', {
      endpoint,
      method: options.method,
      body: options.body,
      bodyType: typeof options.body
    });
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  /* ========================= AUTH ========================= */
  login: async (email: string, password: string) => {
    const response = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.token) {
      localStorage.setItem('auth_token', response.token);
    }
    return response;
  },

  register: async (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    referralCode?: string;
    affiliateId?: string;
    country?: string;
  }) => {
    const response = await fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.token) {
      localStorage.setItem('auth_token', response.token);
    }
    return response;
  },

  getCurrentUser: () => fetchAPI('/auth/me'),

  updateProfile: (data: { name?: string; phone?: string; country?: string }) =>
    fetchAPI('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAccount: () =>
    fetchAPI('/auth/delete-account', { method: 'DELETE' }),

  clearToken: () => {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
  },

  /* ========================= PREDICTIONS ========================= */
  getPredictions: (filters?: {
    status?: string;
    category?: string;
    country?: string;
    creatorId?: string;
    eventId?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    return fetchAPI(`/predictions?${params.toString()}`);
  },

  createPrediction: (data: any) =>
    fetchAPI('/predictions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  resolvePrediction: (id: string, winningOptionId: string) =>
    fetchAPI(`/predictions/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ winning_option_id: winningOptionId }),
    }),

  deletePrediction: (id: string) =>
    fetchAPI(`/predictions/${id}`, { method: 'DELETE' }),

  /* ========================= ENTRIES ========================= */
  getEntries: (status?: string) =>
    fetchAPI(`/entries${status ? `?status=${status}` : ''}`),

  placeEntry: (data: {
    prediction_id: string;
    selected_option_id: string;
    amount: number;
  }) =>
    fetchAPI('/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /* ========================= WALLET ========================= */
  getBalance: () => fetchAPI('/wallet/balance'),

  getTransactions: () => fetchAPI('/transactions'),

  cashout: (data: { amount: number; phone: string; method: string }) =>
    fetchAPI('/wallet/cashout', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /* ========================= ADMIN ========================= */
  getAdminStats: () => fetchAPI('/admin/stats'),

  getAnalytics: () => fetchAPI('/admin/analytics'),

  getUsers: () => fetchAPI('/admin/users'),

  /**
   * 🔐 ADMIN TOKEN INJECTION (AUDITABLE)
   */
  injectTokens: (data: {
    user_identifier: string; // email or UID
    amount: number;
    reason: string;
    note?: string;
  }) =>
    fetchAPI('/admin/inject-tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * ⚠️ LEGACY (optional, keep if backend still uses it)
   */
  addUserBalance: (uid: string, amount: number, description?: string) =>
    fetchAPI(`/admin/users/${uid}/add-balance`, {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    }),

  /* ========================= SETTINGS ========================= */
  getSettings: () => fetchAPI('/settings'),

  updateSettings: (data: any) =>
    fetchAPI('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /* ========================= CREATORS ========================= */
  getCreatorInvites: () => fetchAPI('/admin/creator-invites'),

  createCreatorInvite: (data: { name: string; country: string }) =>
    fetchAPI('/admin/creator-invites', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revokeCreatorInvite: (id: string) =>
    fetchAPI(`/admin/creator-invites/${id}/revoke`, {
      method: 'POST',
    }),

  validateCreatorInvite: (code: string) =>
    fetchAPI(`/creator-invites/validate/${code}`),

  claimCreatorInvite: (code: string, email: string, password: string) =>
    fetchAPI('/creator-invites/claim', {
      method: 'POST',
      body: JSON.stringify({ code, email, password }),
    }),

  /* ========================= AFFILIATES ========================= */
  validateAffiliate: (code: string) =>
    fetchAPI(`/affiliates/validate?code=${code}`),

  createAffiliate: (data: { name: string; code: string }) =>
    fetchAPI('/admin/affiliates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAffiliates: () => fetchAPI('/admin/affiliates'),
};
