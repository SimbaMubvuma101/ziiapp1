import { PredictionOption } from "../types";

// Zii Pricing Engine Configuration
const PRICING_CONFIG = {
  // Base Entry Price: The floor constant for the formula.
  // Formula: Price = BASE / (1 - AdjustedProbability)
  // With BASE=2.0:
  // - 50% Prob -> $4.00 Entry (Win $10) -> 2.5x Return
  // - 80% Prob -> $10.00 Entry (Win $10) -> Break Even Cap
  BASE_ENTRY_PRICE: 2.0, 

  FIXED_PAYOUT: 10,

  // Smoothing Factor for Softmax (Step 2)
  // Lower = More smoothing (flatter prices)
  // Higher = More aggressive pricing changes
  SOFTMAX_EXPONENT: 0.85,
  
  // Time Factor Logic
  // Only applies in the last 20% of the window
  TIME_FACTOR_THRESHOLD: 0.2, 
};

interface AMMOutput {
  updatedOptions: PredictionOption[];
}

/**
 * Zii Entry Pricing Engine
 * Implements the 3-Step Algorithm:
 * 1. Base Probability (Liq / Total)
 * 2. Softmax Adjustment
 * 3. Demand Curve Pricing + Time Factor
 * 
 * Supports 'multiplier' for High Roller modes.
 */
export const calculateAMMOdds = (
  options: PredictionOption[],
  liquidityPool: Record<string, number>,
  created_at?: string,
  closes_at?: string,
  multiplier: number = 1
): AMMOutput => {
  
  // --- STEP 1: Compute Base Liquidity & Probability ---
  let totalLiquidity = 0;
  options.forEach(opt => {
    totalLiquidity += (liquidityPool[opt.id] || 0);
  });

  // Handle Zero State
  if (totalLiquidity === 0) {
    // Base calculation
    let equalPrice = (PRICING_CONFIG.BASE_ENTRY_PRICE / (1 - (1/options.length)));
    // Apply Multiplier
    equalPrice = equalPrice * multiplier;
    
    return {
        updatedOptions: options.map(o => ({ ...o, price: Number(equalPrice.toFixed(2)) }))
    };
  }

  // --- STEP 2: Apply Softmax Adjustment (Smooths Outliers) ---
  // adjusted_p = (p^0.85) / sum(p^0.85)
  const probs: Record<string, number> = {};
  let sumPowerProbs = 0;

  options.forEach(opt => {
    const liq = liquidityPool[opt.id] || 0;
    const baseProb = liq / totalLiquidity;
    
    // Prevent 0 probability error
    const safeProb = Math.max(baseProb, 0.001);
    const powerProb = Math.pow(safeProb, PRICING_CONFIG.SOFTMAX_EXPONENT);
    
    sumPowerProbs += powerProb;
    probs[opt.id] = powerProb; // Store temporary numerator
  });

  // --- STEP 3: Compute Entry Price & Time Factor ---
  // entry_price = BASE / (1 - adjusted_p)

  // Calculate Time Factor
  let timeFactor = 1.0;
  if (created_at && closes_at) {
      const now = Date.now();
      const start = new Date(created_at).getTime();
      const end = new Date(closes_at).getTime();
      const totalDuration = end - start;
      const remaining = end - now;

      if (totalDuration > 0 && remaining > 0) {
          const ratioRemaining = remaining / totalDuration;
          
          // Apply only in last 20%
          if (ratioRemaining <= PRICING_CONFIG.TIME_FACTOR_THRESHOLD) {
              // Factor scales from 1.0 to 1.2 as time runs out
              timeFactor = 1 + (0.2 * (1 - (ratioRemaining / PRICING_CONFIG.TIME_FACTOR_THRESHOLD)));
          }
      }
  }

  const updatedOptions = options.map(opt => {
    // Final Adjusted Probability
    const adjustedProb = probs[opt.id] / sumPowerProbs;

    // Cap Probability to prevent Infinite Price (Division by Zero)
    // Max Prob 0.85 ensures Price never exceeds ~13.33 (2 / 0.15)
    // For a $10 payout, we strictly cap prob at 0.80 -> Price $10.00
    const cappedProb = Math.min(adjustedProb, 0.80);

    // Core Formula
    let rawPrice = PRICING_CONFIG.BASE_ENTRY_PRICE / (1 - cappedProb);

    // Apply Time Factor
    rawPrice = rawPrice * timeFactor;

    // Apply High Roller Multiplier
    rawPrice = rawPrice * multiplier;

    // Hard Floor (Base Price scaled)
    if (rawPrice < (PRICING_CONFIG.BASE_ENTRY_PRICE * multiplier)) {
        rawPrice = (PRICING_CONFIG.BASE_ENTRY_PRICE * multiplier);
    }

    // Safety Cap (Scaled)
    // We allow it to go slightly above 10*multiplier if time factor is high
    const cap = 12 * multiplier;
    if (rawPrice > cap) rawPrice = cap;

    return {
      ...opt,
      price: Math.round(rawPrice * 100) / 100
    };
  });

  return {
    updatedOptions
  };
};

export const FIXED_PAYOUT_AMOUNT = PRICING_CONFIG.FIXED_PAYOUT;