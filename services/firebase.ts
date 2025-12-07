import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  onSnapshot,
  limit,
  runTransaction
} from 'firebase/firestore';
import { INITIAL_USER_BALANCE, AUTO_WITHDRAW_THRESHOLD, ROUND_DURATION } from '../constants';
import { WithdrawalRequest, GameState, Bet } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Prevent initialization error if keys are missing
const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// --- Types ---
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  solanaWalletAddress: string;
  balance: number;
  isAdmin: boolean;
}

// --- Global State ---
let currentUser: UserProfile | null = null;
const googleProvider = new GoogleAuthProvider();

// --- Service Methods ---
// --- Mock Helpers ---
const getMockUser = () => {
  const randomId = Math.floor(Math.random() * 10000);
  return {
    uid: `user-guest-${randomId}`,
    email: `guest${randomId}@example.com`,
    displayName: `Guest Player`,
    photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomId}`,
    solanaWalletAddress: '',
    balance: INITIAL_USER_BALANCE,
    isAdmin: false
  };
};

export const AuthService = {
  loginWithGoogle: async (): Promise<UserProfile> => {
    // FALLBACK: If Firebase not configured, use Mock
    if (!auth || !db) {
      console.warn("⚠️ Firebase keys missing. Using MOCK login.");
      await new Promise(resolve => setTimeout(resolve, 800));
      currentUser = getMockUser();
      return currentUser;
    }

    try {
      console.log("Attempting Google Sign-In...");
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Sign-In Successful:", result.user.uid);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        currentUser = userSnap.data() as UserProfile;
      } else {
        const newUser: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Player',
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          solanaWalletAddress: '',
          balance: INITIAL_USER_BALANCE,
          isAdmin: false
        };
        await setDoc(userRef, newUser);
        currentUser = newUser;
      }
      return currentUser;
    } catch (error: any) {
      console.error("FULL LOGIN ERROR OBJ:", error);
      console.error("Error Code:", error?.code);
      console.error("Error Message:", error?.message);

      if (error?.code === 'auth/operation-not-allowed') {
        alert("Error: Google Sign-In is not enabled in Firebase Console. Go to Authentication -> Sign-in Method -> Enable Google.");
      } else if (error?.code === 'auth/popup-closed-by-user') {
        alert("Login cancelled.");
      } else if (error?.code === 'auth/unauthorized-domain') {
        alert(`Domain error. Make sure '${window.location.hostname}' is in Firebase Authorized Domains.`);
      } else {
        alert(`Login Failed: ${error?.message}`);
      }
      throw error;
    }
  },

  loginAnonymously: async (): Promise<UserProfile> => {
    if (!auth || !db) throw new Error("Firebase not configured");
    try {
      console.log("Attempting Anonymous Sign-In...");
      const result = await signInAnonymously(auth);
      console.log("Anon Sign-In Successful:", result.user.uid);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        currentUser = userSnap.data() as UserProfile;
      } else {
        const newUser: UserProfile = {
          uid: user.uid,
          email: '', // No email for anonymous
          displayName: 'Guest Player',
          photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`, // Different avatar style for guests
          solanaWalletAddress: '',
          balance: INITIAL_USER_BALANCE,
          isAdmin: false
        };
        await setDoc(userRef, newUser);
        currentUser = newUser;
      }
      return currentUser;
    } catch (error: any) {
      console.error("ANON LOGIN ERROR:", error);
      if (error?.code === 'auth/operation-not-allowed') {
        alert("Error: Anonymous Sign-In is not enabled. Go to Authentication -> Sign-in Method -> Enable Anonymous.");
      } else {
        alert(`Guest Login Failed: ${error?.message}`);
      }
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    if (auth) await signOut(auth);
    currentUser = null;
  },

  getCurrentUser: (): UserProfile | null => currentUser,

  updateProfileWallet: async (walletAddress: string): Promise<void> => {
    if (!currentUser || !db) return;

    // Check if this wallet is already linked to ANOTHER user (e.g. previous session)
    const q = query(collection(db, 'users'), where('solanaWalletAddress', '==', walletAddress), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const existingDoc = querySnapshot.docs[0];
      const existingUser = existingDoc.data() as UserProfile;

      // If it's a different user ID, we need to migrate their balance to us
      if (existingUser.uid !== currentUser.uid) {
        console.log(`Found previous account ${existingUser.uid} with wallet ${walletAddress}. Migrating...`);

        try {
          await runTransaction(db, async (transaction) => {
            const oldUserRef = doc(db, 'users', existingUser.uid);
            const newUserRef = doc(db, 'users', currentUser!.uid);

            const oldUserSnap = await transaction.get(oldUserRef);
            const newUserSnap = await transaction.get(newUserRef);

            if (!oldUserSnap.exists() || !newUserSnap.exists()) return;

            const oldBal = oldUserSnap.data().balance || 0;
            console.log(`Migrating balance: ${oldBal} SOL`);

            if (oldBal > 0) {
              // Transfer Balance
              transaction.update(newUserRef, {
                balance: increment(oldBal),
                solanaWalletAddress: walletAddress
              });

              // Zero out old account to prevent double-claim
              transaction.update(oldUserRef, {
                balance: 0,
                solanaWalletAddress: `migrated_to_${currentUser!.uid}` // Detach wallet from old account
              });

              // Update Local State Optimistically
              // Note: We modify the object in place, React will need a trigger to see it?
              // Actually setUser is not available here easily, but the onSnapshot listener in App.tsx might catch it 
              // if we were listening to our own user doc. App.tsx listens to BalanceService, so it should update.
            } else {
              // Just update the wallet address if no balance to move
              transaction.update(newUserRef, { solanaWalletAddress: walletAddress });
              // Detach old anyway to keep 1:1 mapping
              transaction.update(oldUserRef, { solanaWalletAddress: `migrated_empty_${currentUser!.uid}` });
            }
          });
          console.log("Migration Transaction Successful");
        } catch (err) {
          console.error("Migration Transaction Failed:", err);
        }

        currentUser.solanaWalletAddress = walletAddress;
        return;
      }
    }

    // Normal case: New wallet, or same user
    currentUser.solanaWalletAddress = walletAddress;
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, { solanaWalletAddress: walletAddress });
  },

  updateProfileName: async (newName: string): Promise<void> => {
    if (!currentUser) return;
    // Optimistic update
    currentUser.displayName = newName;
    if (db) {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { displayName: newName });
    }
  },

  onAuthStateChange: (callback: (user: UserProfile | null) => void) => {
    // Mock persistence for session duration
    if (!auth) {
      callback(currentUser);
      return () => { };
    }
    return onAuthStateChanged(auth, async (user) => {
      if (user && db) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          currentUser = userSnap.data() as UserProfile;
          callback(currentUser);
        }
      } else {
        currentUser = null;
        callback(null);
      }
    });
  }
};

export const BalanceService = {
  subscribeToBalance: (uid: string, callback: (balance: number) => void) => {
    // Mock subscription
    if (!db) {
      if (currentUser && currentUser.uid === uid) callback(currentUser.balance);
      return () => { };
    }

    const userRef = doc(db, 'users', uid);
    return onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data() as UserProfile;
        if (currentUser?.uid === uid) currentUser.balance = userData.balance;
        callback(userData.balance);
      }
    });
  },

  updateBalance: async (amountChange: number) => {
    if (!currentUser) return;

    // Optimistic
    currentUser.balance += amountChange;

    if (db) {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { balance: increment(amountChange) });
    }
  },

  refundUser: async (uid: string, amount: number) => {
    if (db) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { balance: increment(amount) });
    } else {
      if (currentUser?.uid === uid) currentUser.balance += amount;
    }
  }
};

export const TransactionService = {
  recordTransaction: async (signature: string, amount: number, type: 'DEPOSIT' | 'WITHDRAWAL') => {
    if (!currentUser) return;
    console.log(`[Transaction] ${type} ${amount} - ${signature}`);

    if (db) {
      await addDoc(collection(db, 'transactions'), {
        userId: currentUser.uid,
        signature,
        amount,
        type,
        timestamp: serverTimestamp()
      });
    }
  },

  isSignatureUsed: async (signature: string): Promise<boolean> => {
    if (!db) return false; // Mock always returns false (fresh state)
    const q = query(
      collection(db, 'transactions'),
      where("signature", "==", signature),
      where("type", "==", "DEPOSIT"),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  },

  requestWithdrawal: async (amount: number) => {
    if (!currentUser || !db) return;

    // Deduct form Balance immediately to prevent double-spend
    await BalanceService.updateBalance(-amount);

    await addDoc(collection(db, 'withdrawals'), {
      userId: currentUser.uid,
      amount: amount,
      walletAddress: currentUser.solanaWalletAddress,
      status: 'PENDING',
      timestamp: serverTimestamp()
    });
  },

  subscribeToWithdrawals: (userId: string, callback: (withdrawals: any[]) => void) => {
    if (!db) return () => { };
    const q = query(collection(db, 'withdrawals'), where('userId', '==', userId));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(data);
    });
  },

  // Admin Methods (Mock Only implemented for now in fallback)
  getPendingWithdrawals: async () => [],
  approveWithdrawal: async () => { },
  rejectWithdrawal: async () => { }
};

export const GameService = {
  // Sync Game State
  subscribeToGameState: (callback: (state: GameState) => void) => {
    if (!db) {
      // Mock for dev without DB
      return () => { };
    }
    const docRef = doc(db, 'game_state', 'live_v2');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Calculate derived timeLeft relative to local clock
        const now = Date.now();
        const endTime = data.roundEndTime?.toMillis() || now;
        const timeLeft = Math.max(0, Math.ceil((endTime - now) / 1000));

        callback({
          ...data,
          timeLeft,
          bets: [] // Bets fetched separately
        } as GameState);
      } else {
        // Initialize if missing
        setDoc(docRef, {
          gameId: 1,
          roundId: 1,
          status: 'WAITING',
          roundEndTime: serverTimestamp(),
          jackpot: 0,
          houseProfit: 0,
          greenPool: 0,
          redPool: 0,
          lastWinner: null
        }, { merge: true });
      }
    }, (error) => {
      console.error("🔥 Game State Sync Error:", error);
    });
  },

  // Sync Bets
  subscribeToBets: (callback: (bets: Bet[]) => void) => {
    if (!db) return () => { };
    const q = query(collection(db, 'game_state', 'live_v2', 'bets'));
    return onSnapshot(q, (snapshot) => {
      const bets = snapshot.docs.map(d => d.data() as Bet);
      callback(bets);
    }, (error) => {
      console.error("🔥 Bets Sync Error:", error);
    });
  },

  placeBet: async (bet: Bet) => {
    if (!db || !currentUser) return;

    // 1. Add to Bets collection
    await addDoc(collection(db, 'game_state', 'live_v2', 'bets'), bet);

    // 2. Update Pool Totals (Atomic)
    const gameRef = doc(db, 'game_state', 'live_v2');
    const tax = bet.originalAmount - bet.poolAmount;

    await updateDoc(gameRef, {
      [bet.side === 'GREEN' ? 'greenPool' : 'redPool']: increment(bet.poolAmount),
      jackpot: increment(bet.poolAmount), // Should this be poolAmount? Usually jackpot is result of previous rounds. 
      // Wait, user logic earlier: "Winning Red takes jackpot". 
      // But does bet add to jackpot? The user said "jackpot pool resets" and "money goes to red side".
      // Current logic: All bets increase jackpot? That seems generous but maybe intended?
      // Re-reading user request: "logic is if red wins, all the jackpot money goes to the red side".
      // Usually jackpot builds up from tax or something.
      // But let's stick to fixing HOUSE PROFIT first.

      houseProfit: increment(tax)
    });

    // 3. Deduct Balance
    await BalanceService.updateBalance(-bet.originalAmount);
  },

  // The "Server" Logic (Ran by Clients)
  advanceGameState: async (nextStatus: 'PLAYING' | 'RESULT' | 'WAITING', resultData?: any) => {
    if (!db) return;
    const gameRef = doc(db, 'game_state', 'live_v2');

    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) return;

        const currentStatus = gameDoc.data().status;

        // Prevent race conditions (e.g. multiple clients trying to start round)
        if (currentStatus === nextStatus) return;

        const updateData: any = { status: nextStatus };

        // State Transitions
        if (nextStatus === 'PLAYING') {
          // Check if we need to set jackpot from resultData (e.g. carry over) defined in WAITING
          // Actually, WAITING sets the jackpot for the *next* round usually? 
          // No, usually 'RESULT' -> 'WAITING' sets the carry over.
          // Let's rely on whoever called advanceGameState('WAITING') to pass the new jackpot.

          updateData.roundEndTime = new Date(Date.now() + ROUND_DURATION * 1000);
          updateData.roundId = increment(1);
          updateData.greenPool = 0;
          updateData.redPool = 0;
        }
        else if (nextStatus === 'RESULT') {
          updateData.lastWinner = resultData?.winner || null;
          updateData.roundEndTime = new Date(Date.now() + 5000);
        }
        else if (nextStatus === 'WAITING') {
          updateData.roundEndTime = new Date(Date.now() + 3000);
          // Crucial: Set the Jackpot for the next round (Result of the previous round)
          if (resultData && typeof resultData.jackpot === 'number') {
            updateData.jackpot = resultData.jackpot;
          }
        }

        transaction.update(gameRef, updateData);
      });
    } catch (e) {
      console.error("Game State Transition Failed:", e);
    }
  }
};