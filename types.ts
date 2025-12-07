
export type Team = 'RED' | 'GREEN';

export interface Bet {
  id: string;
  playerId: string;
  playerName: string;
  isBot: boolean;
  side: Team;
  originalAmount: number; // Amount before tax
  poolAmount: number;     // Amount added to pool (after tax)
  timestamp: number;
  roundId?: number;
}

export interface GameState {
  gameId: number;
  roundId: number;
  status: 'WAITING' | 'PLAYING' | 'RESOLVING';
  timeLeft: number;
  jackpot: number;
  houseProfit: number;
  greenPool: number;
  redPool: number;
  bets: Bet[];
  lastWinner: Team | 'DRAW' | null;
}

export interface LogEntry {
  id: string;
  message: string;
  type: 'INFO' | 'GREEN' | 'RED' | 'ALERT';
  timestamp: number;
}

export interface Bot {
  id: string;
  name: string;
  type: 'NORMIE' | 'WHALE' | 'SNIPER';
  balance: number;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  walletAddress: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: number;
  txHash?: string; // Filled by admin when approved
}
