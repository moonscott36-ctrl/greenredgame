import React, { useState } from 'react';
import { Copy, QrCode, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { HOUSE_WALLET_ADDRESS } from '../constants';
import { SolanaService } from '../services/solana';
import { UserProfile } from '../services/firebase';

interface DepositModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({ user, isOpen, onClose }) => {
  const [signature, setSignature] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(HOUSE_WALLET_ADDRESS);
    // Could add toast here
  };

  const handleVerify = async () => {
    if (!signature) return;
    setVerifying(true);
    setResult(null);

    try {
      // Call the service
      const verifyResult = await SolanaService.verifyDeposit(signature, user);

      setResult({
        success: verifyResult.success,
        message: verifyResult.success
          ? `Successfully credited ◎${verifyResult.amount?.toFixed(2)}`
          : verifyResult.message || "Verification failed"
      });

      if (verifyResult.success) {
        setSignature('');
        setTimeout(() => {
          onClose();
          setResult(null);
        }, 2000);
      }
    } catch (error: any) {
      console.error("Verification Panic:", error);
      setResult({
        success: false,
        message: `System Error: ${error.message || "Unknown error occurred"}`
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-green-500"></div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-display text-white">Deposit SOL</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>

          {!user.solanaWalletAddress ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <XCircle className="text-red-500 shrink-0" size={20} />
                <p className="text-sm text-red-200">
                  Please save your <strong>Sending Wallet Address</strong> in your profile before depositing.
                  We reject claims from unknown wallets to prevent sniping.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: House Wallet Display */}
              <div className="bg-slate-800 rounded-xl p-4 mb-6 text-center">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Send SOL to House Wallet</p>
                <div className="bg-white p-2 rounded-lg inline-block mb-3">
                  <QrCode size={120} className="text-black" />
                </div>

                <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-lg border border-slate-700">
                  <code className="text-xs text-blue-400 font-mono flex-1 break-all text-left">
                    {HOUSE_WALLET_ADDRESS}
                  </code>
                  <button onClick={handleCopy} className="text-slate-500 hover:text-white transition-colors">
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              {/* Step 2: Signature Input */}
              <div className="space-y-4">
                <div className="text-sm text-slate-300">
                  Paste your <strong>Transaction Signature</strong> or Solscan Link below.
                </div>

                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Ex: 5Kj3... or solscan.io/tx/..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white font-mono focus:border-purple-500 focus:outline-none transition-colors"
                />

                <button
                  onClick={handleVerify}
                  disabled={verifying || !signature}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifying ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                  {verifying ? 'Verifying On-Chain...' : 'Verify & Credit'}
                </button>


              </div>
            </>
          )}

          {result && (
            <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${result.success ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {result.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {result.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};