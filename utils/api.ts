// Detect environment
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// For localhost development, use full URL
// For deployed/production (including Replit), use empty string (same origin)
const API_BASE_URL = isLocalhost ? 'http://localhost:5000' : '';

// Log API configuration on load
console.log('API Configuration:', { 
  hostname: window.location.hostname,
  isLocalhost,
  apiBase: API_BASE_URL,
  fullUrl: isLocalhost ? API_BASE_URL : window.location.origin
});

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}/api${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem('authToken');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
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
  login: (email: string, password: string) =>
    fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { name: string; email: string; password: string; phone?: string; referralCode?: string; affiliateId?: string; country?: string }) =>
    fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

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

  // Predictions endpoints
  getPredictions: (params?: { status?: string; category?: string; country?: string; creatorId?: string; eventId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.category) query.append('category', params.category);
    if (params?.country) query.append('country', params.country);
    if (params?.creatorId) query.append('creatorId', params.creatorId);
    if (params?.eventId) query.append('eventId', params.eventId);
    return fetchAPI(`/predictions?${query.toString()}`);
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

  claimCreatorInvite: (data: { code: string; email: string; password: string }) =>
    fetchAPI('/creator-invites/claim', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Affiliate validation
  validateAffiliate: (code: string) =>
    fetchAPI(`/affiliates/validate?code=${code}`),
};