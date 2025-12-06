import { LATE_GAME_START, BASE_TAX, MAX_TAX } from '../constants';

export const calculateCurrentTax = (timeLeft: number): number => {
  if (timeLeft > LATE_GAME_START) {
    return BASE_TAX;
  }

  // Linear interpolation from BASE_TAX to MAX_TAX over the last 30 seconds
  const progress = (LATE_GAME_START - timeLeft) / LATE_GAME_START;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return BASE_TAX + (clampedProgress * (MAX_TAX - BASE_TAX));
};

export const formatCurrency = (amount: number): string => {
  return '◎ ' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatUSD = (amount: number): string => {
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const generateId = (): string => Math.random().toString(36).substring(2, 9);

export const shortenAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};