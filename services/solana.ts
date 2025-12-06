import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { shortenAddress } from '../utils/gameMath';
import { HOUSE_WALLET_ADDRESS, SOLANA_RPC_ENDPOINTS } from '../constants';
import { TransactionService, BalanceService, UserProfile } from './firebase';

interface VerificationResult {
  success: boolean;
  amount?: number;
  message?: string;
}

export const SolanaService = {
  /**
   * Verifies a user's manual deposit by checking the signature on-chain.
   * Uses RPC Failover to ensure robustness against public node rate limits.
   */
  verifyDeposit: async (inputSignature: string, user: UserProfile): Promise<VerificationResult> => {
    // Clean input: remove whitespace and extract from URL if pasted
    let signature = inputSignature.trim();
    if (signature.includes("solscan.io/tx/")) {
      const parts = signature.split("solscan.io/tx/");
      if (parts[1]) signature = parts[1].split("?")[0].trim();
    }

    if (!user.solanaWalletAddress) {
      return { success: false, message: "Please save your Wallet Address in profile first." };
    }

    // 1. Check Double Spend (Database)
    // We do this BEFORE chain check to save RPC calls
    const isUsed = await TransactionService.isSignatureUsed(signature);
    if (isUsed) {
      return { success: false, message: "This transaction signature has already been claimed." };
    }

    // 2. Fetch Transaction from Chain with Failover
    let parsedTx = null;
    let lastError = "";

    // Iterate through all available endpoints
    // Iterate through all available endpoints
    for (const endpoint of SOLANA_RPC_ENDPOINTS) {
      if (!endpoint) continue;
      try {
        console.log(`Attempting verification via ${endpoint.slice(0, 25)}...`);
        // We set a shorter timeout for the connection request to fail fast on dead RPCs
        const connection = new Connection(endpoint, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 5000 // 5s timeout
        });

        // Race the fetch against a strict timeout promise
        const fetchPromise = connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("RPC_TIMEOUT")), 8000)
        );

        parsedTx = await Promise.race([fetchPromise, timeoutPromise]) as any;

        // If we get here without error, the RPC call succeeded
        break;
      } catch (e: any) {
        console.warn(`RPC Failed (${endpoint.slice(0, 25)}...):`, e.message || e);
        lastError = e.message || "Unknown Error";
        // Continue to next endpoint...
      }
    }

    if (parsedTx === null) {
      // It could be truly not found, or all RPCs failed.
      // If lastError indicates network failure, suggest waiting.
      if (lastError.includes("429") || lastError.includes("403")) {
        return { success: false, message: "Network busy (All Public RPCs). Please wait 1 minute and try again." };
      }
      return { success: false, message: "Transaction not found on-chain. Please wait for confirmation." };
    }

    if (parsedTx.meta?.err) {
      return { success: false, message: "Transaction failed on-chain." };
    }

    // 3. Analyze Transfer Instructions
    // Account keys can be complex objects or strings depending on version/parsing
    const message = parsedTx.transaction.message;
    const accountKeys = message.accountKeys;

    let signer = "";

    // Safely find signer
    if (Array.isArray(accountKeys)) {
      // Check if elements are objects with 'signer' prop or just public keys
      const firstKey = accountKeys[0];
      if (typeof firstKey === 'object' && 'signer' in firstKey) {
        signer = accountKeys.find((k: any) => k.signer)?.pubkey.toString();
      } else {
        // Fallback for Legacy/Raw: index 0 is always fee payer/signer in simple transfers
        signer = firstKey.toString();
      }
    }

    if (!signer || (signer !== user.solanaWalletAddress)) {
      console.log("Signer Mismatch:", { expected: user.solanaWalletAddress, actual: signer, keys: accountKeys });
      return {
        success: false,
        message: `Anti-Snipe Mismatch! Transaction sender (${shortenAddress(signer)}) does not match your profile wallet.`
      };
    }

    // We need to calculate the balance change for the House Wallet to verify receipt
    const houseIndex = accountKeys.findIndex((k: any) => k.pubkey.toString() === HOUSE_WALLET_ADDRESS);

    if (houseIndex === -1) {
      return { success: false, message: "House Wallet not found in this transaction." };
    }

    const preBalance = parsedTx.meta?.preBalances[houseIndex] || 0;
    const postBalance = parsedTx.meta?.postBalances[houseIndex] || 0;
    const diff = postBalance - preBalance;

    let depositAmount = 0;
    if (diff > 0) {
      depositAmount = diff / LAMPORTS_PER_SOL;
    } else {
      return { success: false, message: "No SOL transfer to House Wallet detected." };
    }

    // 4. Success - Credit User
    await TransactionService.recordTransaction(signature, depositAmount, 'DEPOSIT');
    await BalanceService.updateBalance(depositAmount);

    return { success: true, amount: depositAmount };
  }
};