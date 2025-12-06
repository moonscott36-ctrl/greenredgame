
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Team,
  GameState,
  LogEntry,
  Bot,
  Bet
} from './types';
import {
  ROUND_DURATION,
  BOT_COUNT,
  BOT_NAMES_PREFIX,
  MAX_BET
} from './constants';
import { calculateCurrentTax, formatCurrency, formatUSD, generateId, shortenAddress } from './utils/gameMath';
import { useSolanaPrice } from './hooks/useSolanaPrice';
import { TimerDisplay } from './components/TimerDisplay';
import { PoolBar } from './components/PoolBar';
import { ActivityFeed } from './components/ActivityFeed';
import { DepositModal } from './components/DepositModal';
import { AdminPanel } from './components/AdminPanel';
import {
  Trophy,
  DollarSign,
  Zap,
  TrendingUp,
  Landmark,
  Shield,
  Wallet,
  Lock,
  LogOut,
  RefreshCw,
  QrCode,
  Settings,
  Ghost
} from './components/Icons';

// Services
import { AuthService, BalanceService, UserProfile, TransactionService } from './services/firebase';

// Floating text interface
interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

const App: React.FC = () => {
  // --- Auth State ---
  const { publicKey, connected, disconnect } = useWallet();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Start loading true to wait for auth check
  const { price: solPrice } = useSolanaPrice();

  // --- Admin State ---
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // --- Game State ---
  const [betAmount, setBetAmount] = useState<string>('0.5');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    gameId: 1,
    roundId: 1,
    status: 'WAITING',
    timeLeft: ROUND_DURATION,
    jackpot: 50,
    houseProfit: 0,
    greenPool: 0,
    redPool: 0,
    bets: [],
    lastWinner: null,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [shake, setShake] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);

  // --- Refs ---
  const botsRef = useRef<Bot[]>([]);
  const timerRef = useRef<number | null>(null);
  const loginAttempted = useRef(false);

  // --- Auth Effects ---
  // --- Auth Effects ---
  // --- Auth Effects ---
  useEffect(() => {
    // Listen for Firebase Auth State Changes
    const unsub = AuthService.onAuthStateChange((u) => {
      setUser(u);
      setAuthLoading(false); // Auth check complete
    });

    // Safety Timeout: If Firebase doesn't respond in 4 seconds (e.g. network block), unblock UI
    const safetyTimeout = setTimeout(() => {
      setAuthLoading(prev => {
        if (prev) {
          console.warn("Auth Listener timed out - releasing UI lock");
          return false;
        }
        return prev;
      });
    }, 4000);

    return () => {
      unsub();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Sync Wallet with User Profile
  useEffect(() => {
    if (user && connected && publicKey) {
      const walletAddr = publicKey.toBase58();
      if (user.solanaWalletAddress !== walletAddr) {
        AuthService.updateProfileWallet(walletAddr).then(() => {
          setUser(prev => prev ? ({ ...prev, solanaWalletAddress: walletAddr }) : null);
        });
      }
    }
  }, [user, connected, publicKey]);

  // Listen to balance changes from Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = BalanceService.subscribeToBalance(user.uid, (newBal) => {
      setUser(prev => prev ? ({ ...prev, balance: newBal }) : null);
    });
    return () => unsub();
  }, [user?.uid]);

  // Initialize Bots
  useEffect(() => {
    const newBots: Bot[] = [];
    for (let i = 0; i < BOT_COUNT; i++) {
      const typeRoll = Math.random();
      let type: Bot['type'] = 'NORMIE';
      let balance = 2 + Math.random() * 8; // Normies have 2-10 SOL

      if (typeRoll > 0.90) {
        type = 'WHALE';
        balance = 50 + Math.random() * 100; // Whales have 50-150 SOL
      } else if (typeRoll > 0.75) {
        type = 'SNIPER';
        balance = 10 + Math.random() * 40; // Snipers have 10-50 SOL
      }

      const name = `${BOT_NAMES_PREFIX[Math.floor(Math.random() * BOT_NAMES_PREFIX.length)]}_${Math.floor(10 + Math.random() * 90)}`;

      newBots.push({
        id: `bot-${i}`,
        name,
        type,
        balance
      });
    }
    botsRef.current = newBots;

    addLog('System', 'Market Open. Place your bets!', 'INFO');
    setGameState(prev => ({ ...prev, status: 'PLAYING' }));
  }, []);



  // Auto-login when wallet connects
  // Auto-login when wallet connects
  useEffect(() => {
    if (!connected || authLoading) return; // Wait for initial auth check

    // If user is already logged in, just link wallet if needed (handled by other effect)
    if (user) {
      loginAttempted.current = true;
      return;
    }

    if (!user && !loginAttempted.current) {
      const autoWalletLogin = async () => {
        console.log("Wallet connected, auto-logging in...");
        loginAttempted.current = true;
        setAuthLoading(true);
        try {
          // 1. Login Anonymously
          const u = await AuthService.loginAnonymously();

          // 2. Link Wallet immediately
          if (publicKey) {
            const walletAddr = publicKey.toBase58();
            await AuthService.updateProfileWallet(walletAddr);
            u.solanaWalletAddress = walletAddr;
            setUser(u);
          }

          addLog("System", "Wallet Login Successful", "INFO");
        } catch (e: any) {
          console.error("Wallet Login Failed", e);
          if (e?.code === 'auth/too-many-requests') {
            // Squelch this specific error for UX, it usually means we're ALREADY logged in 
            // and the race condition caught us, or we really are spamming. 
            // Since we have onAuthStateChange now, we might eventually recover the session.
            console.warn("Too many login requests - likely race condition handled by AuthState listener.");
          } else {
            alert(`Login Failed: ${e.message}`);
          }
        }
        setAuthLoading(false);
      };
      autoWalletLogin();
    }
  }, [connected, publicKey, user, authLoading]);

  const handleLogout = async () => {
    await disconnect();
    await AuthService.logout();
    setUser(null);
    setShowAdminPanel(false);
    loginAttempted.current = false; // Allow re-login
  };

  const handleWithdraw = async () => {
    if (!user || user.balance <= 0) return;
    if (!user.solanaWalletAddress) {
      alert("Please connect your Solana wallet to withdraw.");
      return;
    }
    const amount = user.balance;
    if (confirm(`Request withdrawal of ${formatCurrency(amount)} to ${shortenAddress(user.solanaWalletAddress)}? This takes up to 24h.`)) {
      await TransactionService.requestWithdrawal(amount);
      alert("Withdrawal requested. An admin will process it shortly.");
    }
  };

  const handleAdminHouseWithdraw = (amount: number) => {
    // Logic to reset house profit counter after admin withdraws
    setGameState(prev => ({ ...prev, houseProfit: prev.houseProfit - amount }));
  };

  const addLog = (sender: string, message: string, type: LogEntry['type']) => {
    setLogs(prev => {
      const newLog = { id: generateId(), message: `${sender}: ${message}`, type, timestamp: Date.now() };
      return [...prev.slice(-49), newLog];
    });
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const addFloatingText = (text: string, color: string) => {
    const id = generateId();
    // Random position within a central safe area 20-80% width/height
    const x = 20 + Math.random() * 60;
    const y = 40 + Math.random() * 20;

    setFloatingTexts(prev => [...prev, { id, x, y, text, color }]);

    // Remove after animation
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
    }, 1000);
  };

  // --- Betting Logic ---
  const placeBet = async (playerId: string, playerName: string, isBot: boolean, side: Team, amount: number) => {
    if (amount <= 0) return;

    // State update for game pool
    setGameState(prevState => {
      const taxRate = calculateCurrentTax(prevState.timeLeft);
      const taxAmount = amount * taxRate;
      const poolContribution = amount - taxAmount;

      const newGreenPool = side === 'GREEN' ? prevState.greenPool + poolContribution : prevState.greenPool;
      const newRedPool = side === 'RED' ? prevState.redPool + poolContribution : prevState.redPool;

      const newBet: Bet = {
        id: generateId(),
        playerId,
        playerName,
        isBot,
        side,
        originalAmount: amount,
        poolAmount: poolContribution,
        timestamp: Date.now()
      };

      return {
        ...prevState,
        greenPool: newGreenPool,
        redPool: newRedPool,
        houseProfit: prevState.houseProfit + taxAmount,
        bets: [...prevState.bets, newBet]
      };
    });

    if (!isBot) {
      await BalanceService.updateBalance(-amount); // Deduct from Firestore (Mock)
      addLog('You', `Bet ${formatCurrency(amount)} on ${side}`, side === 'GREEN' ? 'GREEN' : 'RED');
      addFloatingText(`+${formatCurrency(amount)}`, side === 'GREEN' ? 'text-green-400' : 'text-red-400');
    } else {
      // Bot Effects
      const isWhaleBet = amount > 2; // Whale threshold in SOL

      if (isWhaleBet) {
        addLog(playerName, `WHALE ALERT! Bet ${formatCurrency(amount)} on ${side}`, 'ALERT');
        triggerShake();
        addFloatingText(`WHALE! ${formatCurrency(amount)}`, side === 'GREEN' ? 'text-green-300 font-bold text-xl' : 'text-red-300 font-bold text-xl');
      } else {
        if (Math.random() > 0.8) {
          addLog(playerName, `Bet ${formatCurrency(amount)} on ${side}`, side === 'GREEN' ? 'GREEN' : 'RED');
          if (Math.random() > 0.7) {
            // Occasional floating text for bots
            addFloatingText(`${formatCurrency(amount)}`, side === 'GREEN' ? 'text-green-500/50' : 'text-red-500/50');
          }
        }
      }
    }
  };

  // --- Core Game Loop ---
  useEffect(() => {
    if (gameState.status !== 'PLAYING') return;

    timerRef.current = window.setInterval(() => {
      setGameState(prev => {
        const newTime = prev.timeLeft - 1;
        if (newTime < 0) {
          handleRoundEnd(prev);
          return { ...prev, status: 'RESOLVING', timeLeft: 0 };
        }
        return { ...prev, timeLeft: newTime };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.status]);

  // Bot Actions
  useEffect(() => {
    if (gameState.status !== 'PLAYING') return;

    const time = gameState.timeLeft;
    botsRef.current.forEach(bot => {
      if (bot.balance <= 0.05) return;

      let shouldBet = false;
      let betAmount = 0;
      let side: Team = Math.random() > 0.5 ? 'GREEN' : 'RED';

      if (bot.type === 'NORMIE') {
        const tax = calculateCurrentTax(time);
        const prob = 0.05 * (1 - tax);
        if (Math.random() < prob) {
          shouldBet = true;
          betAmount = Math.min(bot.balance, 0.05 + Math.random() * 0.2);
        }
      } else if (bot.type === 'WHALE') {
        if (Math.random() < 0.01) {
          shouldBet = true;
          betAmount = Math.min(bot.balance, 1.0 + Math.random() * 5.0);
        }
      } else if (bot.type === 'SNIPER') {
        if (time <= 15 && time > 0) {
          if (Math.random() < 0.3) {
            shouldBet = true;
            betAmount = Math.min(bot.balance, bot.balance * (0.2 + Math.random() * 0.3));
          }
        }
      }

      if (shouldBet) {
        bot.balance -= betAmount;
        placeBet(bot.id, bot.name, true, side, betAmount);
      }
    });

  }, [gameState.timeLeft, gameState.status]);


  // --- Resolution Logic ---
  const handleRoundEnd = async (finalState: GameState) => {
    const { greenPool, redPool, jackpot } = finalState;
    let winner: Team | 'DRAW' = 'DRAW';

    if (greenPool > redPool) winner = 'GREEN';
    else if (redPool > greenPool) winner = 'RED';
    else winner = 'DRAW';

    let newJackpot = jackpot;
    let userWinnings = 0;

    const userBets = finalState.bets.filter(b => !b.isBot);

    if (winner === 'GREEN') {
      const totalGreen = greenPool;
      const totalRed = redPool;
      const rewardPool = totalRed * 0.5;
      const toJackpot = totalRed * 0.5;

      newJackpot += toJackpot;

      userBets.forEach(bet => {
        if (bet.side === 'GREEN') {
          const share = bet.poolAmount / totalGreen;
          const profit = share * rewardPool;
          userWinnings += (bet.poolAmount + profit);
        }
      });

      addLog('System', `GREEN WINS! ${formatCurrency(rewardPool)} distributed.`, 'GREEN');

    } else if (winner === 'RED') {
      const totalGreen = greenPool;
      const totalRed = redPool;
      const rewardPool = totalGreen;
      const jackpotWin = jackpot;
      newJackpot = 50; // Reset Jackpot

      userBets.forEach(bet => {
        if (bet.side === 'RED') {
          const share = bet.poolAmount / totalRed;
          const profitFromLosers = share * rewardPool;
          const profitFromJackpot = share * jackpotWin;
          userWinnings += (bet.poolAmount + profitFromLosers + profitFromJackpot);
        }
      });

      addLog('System', `RED WINS! JACKPOT CLAIMED!`, 'RED');
    } else {
      userBets.forEach(bet => {
        userWinnings += bet.poolAmount;
      });
      addLog('System', 'DRAW! Bets refunded.', 'INFO');
    }

    if (userWinnings > 0) {
      await BalanceService.updateBalance(userWinnings);
      setTimeout(() => {
        addLog('System', `YOU WON ${formatCurrency(userWinnings)}!`, 'INFO');
        addFloatingText(`WINNER! +${formatCurrency(userWinnings)}`, 'text-yellow-400 font-bold text-4xl');
        triggerShake();
      }, 500);
    }

    setTimeout(() => {
      resetGame(newJackpot, winner === 'RED');
    }, 8000);
  };

  const resetGame = (carriedJackpot: number, isGameOver: boolean) => {
    setGameState(prev => ({
      gameId: isGameOver ? prev.gameId + 1 : prev.gameId,
      roundId: isGameOver ? 1 : prev.roundId + 1,
      status: 'WAITING',
      timeLeft: ROUND_DURATION,
      jackpot: carriedJackpot,
      houseProfit: prev.houseProfit,
      greenPool: 0,
      redPool: 0,
      bets: [],
      lastWinner: null
    }));

    setLogs([]);
    setTimeout(() => {
      setGameState(prev => ({ ...prev, status: 'PLAYING' }));
      addLog('System', 'Round Started! Voting Open.', 'INFO');
    }, 1000);
  };

  const handleUserBet = (side: Team) => {
    if (!user) {
      alert("Please login to play");
      return;
    }
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (amount > user.balance) {
      alert("Insufficient SOL");
      return;
    }
    if (amount > MAX_BET) {
      alert(`Max bet is ${MAX_BET} SOL per round`);
      return;
    }
    placeBet(user.uid, user.displayName, false, side, amount);
  };

  // --- Render ---
  return (
    <div className={`min-h-screen bg-[#0f172a] bg-grid-pattern text-slate-100 pb-12 overflow-x-hidden ${shake ? 'animate-shake' : ''}`}>

      {/* Modals */}
      {user && (
        <DepositModal
          user={user}
          isOpen={showDepositModal}
          onClose={() => setShowDepositModal(false)}
        />
      )}

      {user?.isAdmin && (
        <AdminPanel
          isOpen={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
          houseProfit={gameState.houseProfit}
          onWithdrawHouse={handleAdminHouseWithdraw}
        />
      )}



      {/* Floating Texts Layer */}
      <div className="fixed inset-0 pointer-events-none z-50">
        {floatingTexts.map(ft => (
          <div
            key={ft.id}
            className={`absolute animate-float-up ${ft.color} font-mono font-bold drop-shadow-md`}
            style={{ left: `${ft.x}%`, top: `${ft.y}%` }}
          >
            {ft.text}
          </div>
        ))}
      </div>

      {/* Header HUD */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-700 p-3 sticky top-0 z-40 shadow-2xl">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Left: Logo & Game Info */}
          <div className="flex items-center gap-4">
            <div className="bg-slate-800 p-2 rounded-lg border border-slate-600">
              <Zap className="text-yellow-400 fill-current" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-display bg-gradient-to-r from-red-500 to-green-500 bg-clip-text text-transparent">
                RED LIGHT GREEN LIGHT
              </h1>
              <div className="flex gap-3 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1"><Trophy size={12} /> GAME #{gameState.gameId}</span>
                <span className="flex items-center gap-1"><RefreshCw size={12} /> ROUND #{gameState.roundId}</span>
                {user?.isAdmin && (
                  <span className="flex items-center gap-1 text-yellow-500"><Landmark size={12} /> HOUSE: {formatCurrency(gameState.houseProfit)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Auth & Balance */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {user ? (
              <>
                <div className="bg-slate-950 rounded-lg p-1.5 pr-4 border border-slate-700 flex items-center gap-3">
                  <img src={user.photoURL} className="w-8 h-8 rounded bg-slate-800" alt="Avatar" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-300">{user.displayName}</span>
                    <div className="flex items-center gap-1 text-green-400 font-mono text-sm leading-none">
                      <Wallet size={12} />
                      {formatCurrency(user.balance)}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 rounded-lg p-1.5 border border-slate-700 flex items-center">
                  <WalletMultiButton className="!bg-transparent !h-8 !px-3 !py-0 !text-xs !font-bold !text-slate-300 hover:!text-white transition-colors" />
                </div>

                <button
                  onClick={() => setShowDepositModal(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-3 rounded shadow-lg transition-transform active:scale-95 flex items-center gap-1"
                >
                  <QrCode size={14} /> DEPOSIT
                </button>

                <button
                  onClick={handleWithdraw}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold py-2.5 px-3 rounded shadow-lg transition-transform active:scale-95 flex items-center gap-1"
                >
                  <LogOut size={14} className="rotate-180" /> CASHOUT
                </button>

                {user.isAdmin && (
                  <button
                    onClick={() => setShowAdminPanel(true)}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2.5 px-3 rounded shadow-lg transition-transform active:scale-95 border border-red-400 flex items-center gap-1"
                  >
                    <Shield size={14} /> ADMIN
                  </button>
                )}

                <button onClick={handleLogout} className="text-slate-500 hover:text-white p-2">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <div className="flex gap-2 items-center">
                <div className="bg-slate-700 rounded-full hover:scale-105 transition-transform shadow-lg">
                  <WalletMultiButton style={{ backgroundColor: 'transparent', height: '40px', fontSize: '12px', fontWeight: 'bold' }}>
                    CONNECT WALLET TO PLAY
                  </WalletMultiButton>
                </div>
              </div>

            )}
          </div>
        </div>
      </header >

      {/* Main Game Area */}
      < main className="max-w-2xl mx-auto px-4 mt-4" >

        {/* Jackpot Marquee */}
        < div className="bg-gradient-to-r from-yellow-600/20 via-yellow-500/10 to-yellow-600/20 border-y border-yellow-500/30 py-1.5 mb-2 text-center backdrop-blur-sm rounded-lg flex flex-col items-center justify-center" >
          <span className="text-yellow-400 font-mono text-xs tracking-[0.2em] animate-pulse">
            CURRENT JACKPOT: {formatCurrency(gameState.jackpot)}
          </span>
          <span className="text-[10px] text-yellow-500/60 font-mono">
            ~{formatUSD(gameState.jackpot * solPrice)}
          </span>
        </div >

        {/* Timer */}
        < div className="mb-4 transform hover:scale-[1.01] transition-transform duration-300" >
          <TimerDisplay timeLeft={gameState.timeLeft} />
        </div >

        {/* Pool Visualization */}
        < PoolBar greenPool={gameState.greenPool} redPool={gameState.redPool} solPrice={solPrice} />

        {/* Betting Controls */}
        < div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-6 border border-slate-700 shadow-2xl relative overflow-hidden group" >
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 text-slate-400">
              <Wallet size={18} />
              <span className="text-sm font-bold uppercase">Wager Amount (SOL)</span>
            </div>
            <div className="flex gap-2">
              {['0.5', '1.0', '2.0', '5.0'].map(amt => (
                <button
                  key={amt}
                  onClick={() => setBetAmount(amt)}
                  className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all border ${betAmount === amt ? 'bg-purple-600 text-white border-purple-400 scale-105 shadow-lg' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleUserBet('GREEN')}
              disabled={gameState.status !== 'PLAYING'}
              className="relative group/btn bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed h-32 rounded-xl transition-all active:scale-[0.98] border-b-4 border-green-800 active:border-b-0 active:translate-y-1 shadow-lg shadow-green-900/50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                <span className="text-3xl font-display text-white drop-shadow-md tracking-wider">VOTE GREEN</span>
                <span className="text-xs bg-black/20 px-2 py-1 rounded text-green-100">Win Share of Red</span>
              </div>
            </button>

            <button
              onClick={() => handleUserBet('RED')}
              disabled={gameState.status !== 'PLAYING'}
              className="relative group/btn bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed h-32 rounded-xl transition-all active:scale-[0.98] border-b-4 border-red-800 active:border-b-0 active:translate-y-1 shadow-lg shadow-red-900/50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                <span className="text-3xl font-display text-white drop-shadow-md tracking-wider">VOTE RED</span>
                <span className="text-xs bg-black/20 px-2 py-1 rounded text-red-100">Win Green + JACKPOT</span>
              </div>
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg py-3 px-4 text-center font-mono text-xl text-white w-full max-w-[200px] focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="Custom Amount"
            />
          </div>
        </div >

        {/* Live Feed */}
        < div className="mt-8" >
          <ActivityFeed logs={logs} />
        </div >

      </main >

      {/* Footer Info */}
      < footer className="max-w-2xl mx-auto mt-12 px-4 text-center text-slate-600 text-xs" >
        <p className="mb-2">RED LIGHT GREEN LIGHT © 2024</p>
        <p>Provably Fair Simulation • Solana Mainnet Beta • Play Responsibly</p>
      </footer >

    </div >
  );
};

export default App;
