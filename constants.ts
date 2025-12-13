import { Prediction, PredictionStatus, PredictionType, UserEntry, Winnings } from './types';

export const SUPPORTED_COUNTRIES = [
  // Southern Africa
  { code: 'ZW', name: 'Zimbabwe', currency: 'USD', symbol: '$', rate: 1, flag: '🇿🇼' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R', rate: 18.5, flag: '🇿🇦' },
  { code: 'BW', name: 'Botswana', currency: 'BWP', symbol: 'P', rate: 13.5, flag: '🇧🇼' },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW', symbol: 'ZK', rate: 27, flag: '🇿🇲' },
  { code: 'NA', name: 'Namibia', currency: 'NAD', symbol: 'N$', rate: 18.5, flag: '🇳🇦' },
  { code: 'LS', name: 'Lesotho', currency: 'LSL', symbol: 'L', rate: 18.5, flag: '🇱🇸' },
  { code: 'SZ', name: 'Eswatini', currency: 'SZL', symbol: 'E', rate: 18.5, flag: '🇸🇿' },
  { code: 'MW', name: 'Malawi', currency: 'MWK', symbol: 'MK', rate: 1750, flag: '🇲🇼' },
  { code: 'MZ', name: 'Mozambique', currency: 'MZN', symbol: 'MT', rate: 64, flag: '🇲🇿' },
  { code: 'AO', name: 'Angola', currency: 'AOA', symbol: 'Kz', rate: 900, flag: '🇦🇴' },

  // East Africa
  { code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh', rate: 130, flag: '🇰🇪' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', symbol: 'TSh', rate: 2600, flag: '🇹🇿' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', symbol: 'USh', rate: 3800, flag: '🇺🇬' },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', symbol: 'RF', rate: 1300, flag: '🇷🇼' },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', symbol: 'Br', rate: 120, flag: '🇪🇹' },
  { code: 'BI', name: 'Burundi', currency: 'BIF', symbol: 'FBu', rate: 2900, flag: '🇧🇮' },
  { code: 'SS', name: 'South Sudan', currency: 'SSP', symbol: '£', rate: 1500, flag: '🇸🇸' },
  { code: 'DJ', name: 'Djibouti', currency: 'DJF', symbol: 'Fdj', rate: 178, flag: '🇩🇯' },
  { code: 'SO', name: 'Somalia', currency: 'SOS', symbol: 'Sh', rate: 570, flag: '🇸🇴' },
  { code: 'MG', name: 'Madagascar', currency: 'MGA', symbol: 'Ar', rate: 4600, flag: '🇲🇬' },
  { code: 'MU', name: 'Mauritius', currency: 'MUR', symbol: 'Rs', rate: 46, flag: '🇲🇺' },
  { code: 'SC', name: 'Seychelles', currency: 'SCR', symbol: 'SR', rate: 14, flag: '🇸🇨' },
  { code: 'KM', name: 'Comoros', currency: 'KMF', symbol: 'CF', rate: 450, flag: '🇰🇲' },
  { code: 'ER', name: 'Eritrea', currency: 'ERN', symbol: 'Nfk', rate: 15, flag: '🇪🇷' },

  // West Africa
  { code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦', rate: 1600, flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', symbol: '₵', rate: 15.5, flag: '🇬🇭' },
  { code: 'CI', name: 'Ivory Coast', currency: 'XOF', symbol: 'CFA', rate: 600, flag: '🇨🇮' },
  { code: 'SN', name: 'Senegal', currency: 'XOF', symbol: 'CFA', rate: 600, flag: '🇸🇳' },
  { code: 'ML', name: 'Mali', currency: 'XOF', symbol: 'CFA', rate: 600, flag: '🇲🇱' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', symbol: 'CFA', rate: 600, flag: '🇧🇫' },
  { code: 'BJ', name: 'Benin', currency: 'XOF', symbol: 'CFA', rate: 600, flag: '🇧🇯' },
  { code: 'TG', name: 'Togo', currency: 'XOF', symbol: 'CFA', rate: 600, flag: '🇹🇬' },
  { code: 'NE', name: 'Niger', currency: 'XOF', symbol: 'CFA', rate: 600, flag: '🇳🇪' },
  { code: 'GW', name: 'Guinea-Bissau', currency: 'XOF', symbol: 'CFA', rate: 600, flag: '🇬🇼' },
  { code: 'LR', name: 'Liberia', currency: 'LRD', symbol: '$', rate: 190, flag: '🇱🇷' },
  { code: 'SL', name: 'Sierra Leone', currency: 'SLE', symbol: 'Le', rate: 22, flag: '🇸🇱' },
  { code: 'GN', name: 'Guinea', currency: 'GNF', symbol: 'FG', rate: 8600, flag: '🇬🇳' },
  { code: 'GM', name: 'Gambia', currency: 'GMD', symbol: 'D', rate: 68, flag: '🇬🇲' },
  { code: 'CV', name: 'Cape Verde', currency: 'CVE', symbol: '$', rate: 100, flag: '🇨🇻' },
  { code: 'MR', name: 'Mauritania', currency: 'MRU', symbol: 'UM', rate: 40, flag: '🇲🇷' },

  // North Africa
  { code: 'EG', name: 'Egypt', currency: 'EGP', symbol: '£', rate: 48, flag: '🇪🇬' },
  { code: 'MA', name: 'Morocco', currency: 'MAD', symbol: 'DH', rate: 10, flag: '🇲🇦' },
  { code: 'DZ', name: 'Algeria', currency: 'DZD', symbol: 'DA', rate: 134, flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisia', currency: 'TND', symbol: 'DT', rate: 3.1, flag: '🇹🇳' },
  { code: 'LY', name: 'Libya', currency: 'LYD', symbol: 'LD', rate: 4.8, flag: '🇱🇾' },
  { code: 'SD', name: 'Sudan', currency: 'SDG', symbol: '£', rate: 600, flag: '🇸🇩' },

  // Central Africa
  { code: 'CM', name: 'Cameroon', currency: 'XAF', symbol: 'FCFA', rate: 600, flag: '🇨🇲' },
  { code: 'CD', name: 'DR Congo', currency: 'CDF', symbol: 'FC', rate: 2800, flag: '🇨🇩' },
  { code: 'CG', name: 'Congo Rep', currency: 'XAF', symbol: 'FCFA', rate: 600, flag: '🇨🇬' },
  { code: 'GA', name: 'Gabon', currency: 'XAF', symbol: 'FCFA', rate: 600, flag: '🇬🇦' },
  { code: 'TD', name: 'Chad', currency: 'XAF', symbol: 'FCFA', rate: 600, flag: '🇹🇩' },
  { code: 'CF', name: 'CAR', currency: 'XAF', symbol: 'FCFA', rate: 600, flag: '🇨🇫' },
  { code: 'GQ', name: 'Eq. Guinea', currency: 'XAF', symbol: 'FCFA', rate: 600, flag: '🇬🇶' },
  { code: 'ST', name: 'Sao Tome', currency: 'STN', symbol: 'Db', rate: 23, flag: '🇸🇹' },
];

// Helper to get symbol
export const getCurrencySymbol = (code: string) => {
  return SUPPORTED_COUNTRIES.find(c => c.code === code)?.symbol || '$';
};

// Helper to get rate
export const getExchangeRate = (code: string) => {
  return SUPPORTED_COUNTRIES.find(c => c.code === code)?.rate || 1;
};

// Helper to seed random liquidity
const seedLiquidity = (id: string) => {
    return {
        [id]: Math.floor(Math.random() * 500) + 100
    };
};

export const MOCK_PREDICTIONS: Prediction[] = [
  {
    id: '1',
    question: 'Will ZESA load shed Harare CBD (Area 1) tonight?',
    type: PredictionType.YES_NO,
    category: 'Trends & Viral',
    pool_size: 4500,
    status: PredictionStatus.OPEN,
    country: 'ZW',
    closes_at: new Date(Date.now() + 18000000).toISOString(), // 5 hours
    liquidity_pool: { 'yes': 2000, 'no': 1500 },
    options: [
      { id: 'yes', label: 'Darkness (Yes)', price: 4.5 },
      { id: 'no', label: 'Lights On (No)', price: 5.5 },
    ]
  },
  {
    id: '2',
    question: 'Dynamos vs Highlanders: Who claims victory?',
    type: PredictionType.MULTIPLE_CHOICE,
    category: 'Music & Culture', // Sports is culture in Zim
    pool_size: 12500,
    status: PredictionStatus.OPEN,
    country: 'ZW',
    closes_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    liquidity_pool: { 'dembare': 5000, 'bosso': 4500, 'draw': 2000 },
    options: [
      { id: 'dembare', label: 'Dynamos', price: 3.5 },
      { id: 'bosso', label: 'Highlanders', price: 3.5 },
      { id: 'draw', label: 'Draw', price: 3.0 },
    ]
  },
  {
    id: '3',
    question: 'Will Winky D\'s new video hit 500k views in 24h?',
    type: PredictionType.YES_NO,
    category: 'Music & Culture',
    pool_size: 8900,
    status: PredictionStatus.OPEN,
    country: 'ZW',
    closes_at: new Date(Date.now() + 86400000).toISOString(),
    liquidity_pool: { 'yes': 6000, 'no': 1000 },
    options: [
      { id: 'yes', label: 'Gaffa Level (Yes)', price: 8.0 },
      { id: 'no', label: 'Not quite (No)', price: 2.0 },
    ]
  }
];

export const MOCK_ENTRIES: UserEntry[] = [];
export const MOCK_WINNINGS: Winnings[] = [];

export const WHATSAPP_PHONE = "263771234567"; // Mock Zim number
export const WHATSAPP_MESSAGE = "Mhoro! I want to buy Zii Coins via EcoCash/InnBucks.";