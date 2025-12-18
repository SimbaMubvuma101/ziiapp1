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

// For localhost development, use full URL with port
// For all Replit domains and production, use empty string (same origin - server handles both frontend and API)
const API_BASE_URL = (isLocalhost && !isReplitDomain) ? 'http://localhost:5000' : '';

// Log API configuration on load
console.log('API Configuration:', {
  hostname: window.location.hostname,
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
  // Check both storage locations for auth token
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  console.log('🔑 Auth Token Retrieved:', token ? 'Present' : 'Missing');
  return token;
};
  if (getAuthToken()) {
    defaultHeaders['Authorization'] = `Bearer ${getAuthToken()}`;
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
  // Auth endpoints
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

  register: async (data: { name: string; email: string; password: string; phone?: string; referralCode?: string; affiliateId?: string; country?: string }) => {
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
    fetchAPI('/auth/delete-account', {
      method: 'DELETE',
    }),

  clearToken: () => {
    localStorage.removeItem('auth_token');
  },

  // Predictions endpoints
  getPredictions: (filters?: { status?: string; category?: string; country?: string; creatorId?: string; eventId?: string }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const queryString = params.toString();
    console.log('🌐 API Request - getPredictions:', {
      filters,
      queryString: queryString || '(empty)',
      fullUrl: `/api/predictions?${queryString}`
    });
    return fetchAPI(`/predictions?${queryString}`);
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
    fetchAPI(`/predictions/${id}`, {
      method: 'DELETE',
    }),

  // Entries endpoints
  getEntries: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchAPI(`/entries${query}`);
  },

  placeEntry: (data: { prediction_id: string; selected_option_id: string; amount: number }) =>
    fetchAPI('/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Wallet endpoints
  getBalance: () => fetchAPI('/wallet/balance'),

  getTransactions: () => fetchAPI('/transactions'),

  redeemVoucher: (code: string) =>
    fetchAPI('/wallet/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  cashout: (data: { amount: number; phone: string; method: string }) =>
    fetchAPI('/wallet/cashout', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Admin endpoints
  getAdminStats: () => fetchAPI('/admin/stats'),

  getAnalytics: () => fetchAPI('/admin/analytics'),

  getSettings: () => fetchAPI('/settings'),

  updateSettings: (data: any) =>
    fetchAPI('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Creator invites
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

  // Affiliate validation
  validateAffiliate: (code: string) =>
    fetchAPI(`/affiliates/validate?code=${code}`),
};