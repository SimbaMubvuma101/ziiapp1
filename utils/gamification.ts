
export const GAME_CONFIG = {
  XP_PER_LEVEL: 10, // 1 Level per standard bet (10 XP)
  XP_PER_BET: 10,
  XP_PER_WIN: 20, // +2 Levels
  REWARD_INTERVAL: 10, // Reward every 10 levels (approx 10 bets)
  REWARD_AMOUNT: 5, // 5 Coins
};

// Calculate Level based on Total XP
export const getLevelFromXP = (xp: number) => {
  // Level starts at 1
  return Math.floor(xp / GAME_CONFIG.XP_PER_LEVEL) + 1;
};

// Calculate progress percentage to next level (0-100)
export const getLevelProgress = (xp: number) => {
  return (xp % GAME_CONFIG.XP_PER_LEVEL) / GAME_CONFIG.XP_PER_LEVEL * 100;
};

// Check if a new level triggers a milestone reward
// Returns boolean
export const isMilestoneLevel = (level: number) => {
  // Trigger at 10, 20, 30...
  return level > 1 && level % GAME_CONFIG.REWARD_INTERVAL === 0;
};
