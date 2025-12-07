export const ROUND_DURATION = 60; // seconds
export const LATE_GAME_START = 20; // seconds remaining when tax starts increasing
export const INITIAL_USER_BALANCE = 0; // Starts at 0, requires deposit
export const BASE_TAX = 0.05; // 5%
export const MAX_TAX = 0.50; // 50%
export const BOT_COUNT = 0; // Disabled for Mainnet Live Version

// Solana Config
// This is a random generated address for demo purposes. 
// In production, replace with your actual House Wallet Public Key.
export const HOUSE_WALLET_ADDRESS = "4KfT4Q7pxtLK7UnQ6V2eFB7NhSFzsnCDq1NFvPMUMPda";
export const SOLANA_RPC_ENDPOINTS = [
  import.meta.env.VITE_SOLANA_RPC_URL, // Custom Helius/QuickNode URL (Highest Priority)
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",
  "https://solana-api.projectserum.com",
  "https://api.mainnet-beta.solana.com"
].filter(Boolean) as string[]; // Filter out undefined if env var is missing

// Economy (Values in SOL)
export const MIN_BET = 0.1;
export const MAX_BET = 2.0;
export const WHALE_THRESHOLD = 5.0;
export const AUTO_WITHDRAW_THRESHOLD = 10.0;

export const BOT_NAMES_PREFIX = [
  'SolDegen', 'PhantomUser', 'BonkLover', 'Soly', 'Anatoly', 'WhaleWatch', 'PaperHands', 'DiamondPaws',
  'JupSpace', 'Raydium', 'Orca', 'Drift', 'Margin', 'Liquidated', 'WAGMI', 'Anon', 'Crypto', 'Chain', 'Block', 'Hash'
];