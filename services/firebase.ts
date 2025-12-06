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
  limit
} from 'firebase/firestore';
import { INITIAL_USER_BALANCE } from '../constants';
import { WithdrawalRequest } from '../types';

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
    if (!currentUser) return;
    currentUser.solanaWalletAddress = walletAddress; // Optimistic update

    if (db) {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { solanaWalletAddress: walletAddress });
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
    if (!currentUser) throw new Error("No user");

    // Deduct
    await BalanceService.updateBalance(-amount);

    if (db) {
      await addDoc(collection(db, 'withdrawals'), {
        userId: currentUser.uid,
        walletAddress: currentUser.solanaWalletAddress,
        amount,
        status: 'PENDING',
        timestamp: serverTimestamp()
      });
    } else {
      console.log("Mock Withdrawal Requested:", amount);
    }
  },

  // Admin Methods (Mock Only implemented for now in fallback)
  getPendingWithdrawals: async () => [],
  approveWithdrawal: async () => { },
  rejectWithdrawal: async () => { }
};