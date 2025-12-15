
export enum PredictionType {
  YES_NO = 'yes_no',
  EXACT_NUMBER = 'exact_number',
  NUMBER_RANGE = 'number_range',
  MULTIPLE_CHOICE = 'multiple_choice',
  TIME_GUESS = 'time_guess',
  DATE_GUESS = 'date_guess',
  PERCENTAGE_GUESS = 'percentage_guess',
  SCORELINE = 'scoreline',
  RANKING_PICK = 'ranking_pick',
  TREND_OUTCOME = 'trend_outcome'
}

export enum PredictionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  RESOLVED = 'resolved',
  ARCHIVED = 'archived'
}

export interface PredictionOption {
  id: string;
  label: string;
  price: number; // CHANGED: Price to buy 1 unit (Share Model)
}

export interface Prediction {
  id: string;
  question: string;
  type: PredictionType;
  options: PredictionOption[];
  closes_at: string; // ISO string
  created_at?: string; // ISO string (New field for Time Factor)
  status: PredictionStatus;
  category: string;
  pool_size: number;
  country: string; // 'ZW', 'ZA', 'NG', etc.
  
  // High Roller / Modes
  mode?: 'normal' | 'high_roller';
  multiplier?: number; // Defaults to 1 if undefined

  // AMM State
  liquidity_pool?: Record<string, number>; // Maps optionId -> coin volume

  winning_option_id?: string; // ID of the option that won
  
  resolution_source?: string; // URL or description of how truth is determined
  
  // New Fields for Input Types
  payout?: number; // Kept for legacy/range types (Standard payout unit)
  validation?: {
    min?: number | string;
    max?: number | string;
    teamA?: string;
    teamB?: string;
    format?: string;
  };
  
  // Creator Fields
  created_by_creator?: string; // Creator UID if created by a creator
  creator_name?: string; // Creator display name
  creator_share?: number; // 50% of platform commission
}

export interface UserEntry {
  id: string;
  userId: string;
  username?: string; 
  prediction_id: string;
  prediction_question: string;
  selected_option_id: string; 
  selected_option_label?: string; 
  amount: number; // Cost paid (Entry Price)
  status: 'active' | 'won' | 'lost';
  potential_payout: number; // Fixed at 10 per unit usually
  created_at?: string;
  celebrated?: boolean; // Track if user has seen the confetti for this win
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'entry' | 'deposit' | 'winnings' | 'cashout' | 'reward';
  amount: number;
  description: string;
  created_at: string;
}

export interface Winnings {
  id: string;
  prediction_question: string;
  amount_won: number;
  date: string;
}

// User Data from Firestore
export interface FirestoreUser {
  uid: string;
  name: string;
  email: string;
  phoneNumber?: string; 
  balance: number; // Zii Coins (Tokens)
  winnings_balance?: number; // Real Cash (Withdrawable)
  
  // Gamification
  level?: number;
  xp?: number;

  photo_file_name: string | null;
  created_at: string;
  isAdmin?: boolean;
  country?: string;
  affiliate_id?: string; // ID of the affiliate who referred this user
  referred_by?: string; // ID of another user who referred (legacy)
  
  // Creator Status
  isCreator?: boolean;
  creator_name?: string;
  creator_country?: string;
  total_events_created?: number;
  total_commission_earned?: number;
}

// Voucher System
export interface Voucher {
  id?: string;
  code: string;
  amount: number;
  status: 'active' | 'redeemed';
  created_at: any;
  created_by: string;
  redeemed_by?: string;
  redeemed_at?: any;
}

// Affiliate System
export interface Affiliate {
  id: string;
  name: string;
  code: string; // Unique referral code (e.g., "KOTW1")
  total_volume: number; // Total volume driven by referred users
  commission_owed: number; // 10% of the 5% House Fee
  active_users_count: number; // Number of users registered under this code
  created_at: any;
}

// Global Platform Settings
export interface PlatformSettings {
  maintenance_mode: boolean;
  welcome_bonus: number;
  referral_bonus: number;
  min_cashout: number;
  banner_message: string;
  banner_active: boolean;
}

// Creator Invite
export interface CreatorInvite {
  id?: string;
  code: string;
  name: string; // Creator name
  country: string;
  status: 'active' | 'claimed' | 'revoked';
  created_at: any;
  created_by: string;
  claimed_by?: string;
  claimed_at?: any;
}

// Creator Profile Extension
export interface CreatorProfile {
  isCreator: boolean;
  creator_name: string;
  creator_country: string;
  total_events_created: number;
  total_commission_earned: number;
}
