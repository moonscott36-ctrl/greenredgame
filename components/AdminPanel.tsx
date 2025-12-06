
import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, RefreshCw, AlertTriangle, ExternalLink, Copy, Server, Database, Activity } from 'lucide-react';
import { TransactionService, UserProfile } from '../services/firebase';
import { WithdrawalRequest } from '../types';
import { formatCurrency, shortenAddress } from '../utils/gameMath';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  houseProfit: number;
  onWithdrawHouse: (amount: number) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, houseProfit, onWithdrawHouse }) => {
  const [activeTab, setActiveTab] = useState<'WITHDRAWALS' | 'HOUSE' | 'SYSTEM'>('WITHDRAWALS');
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Input state for processing
  const [adminTxHash, setAdminTxHash] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    const data = await TransactionService.getPendingWithdrawals();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) fetchRequests();
  }, [isOpen]);

  const handleApprove = async (req: WithdrawalRequest) => {
    if (!adminTxHash) {
        alert("Please provide the Solana Transaction Signature (Hash) proving you sent the funds.");
        return;
    }
    setProcessingId(req.id);
    await TransactionService.approveWithdrawal(req.id, adminTxHash);
    setAdminTxHash('');
    setProcessingId(null);
    fetchRequests();
  };

  const handleReject = async (req: WithdrawalRequest) => {
    if(confirm(`Reject request and refund ${formatCurrency(req.amount)} to user?`)) {
        setProcessingId(req.id);
        await TransactionService.rejectWithdrawal(req.id);
        setProcessingId(null);
        fetchRequests();
    }
  };

  const handleHouseWithdraw = () => {
      if(houseProfit <= 0) return;
      if(confirm(`Withdraw full House Treasury of ${formatCurrency(houseProfit)}?`)) {
          onWithdrawHouse(houseProfit);
          alert("Funds withdrawn. Counter reset.");
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-950 border border-slate-700 w-full max-w-4xl h-[80vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden relative">
        {/* CRT Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 bg-[length:100%_2px,3px_100%]"></div>
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
            <div className="flex items-center gap-3">
                <Shield className="text-red-500" size={24} />
                <h2 className="text-xl font-bold text-red-500 tracking-widest uppercase">Admin Mainframe</h2>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white px-3 py-1 hover:bg-slate-800 rounded transition-colors">
                EXIT SYSTEM
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 overflow-x-auto">
            <button 
                onClick={() => setActiveTab('WITHDRAWALS')}
                className={`px-6 py-3 text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'WITHDRAWALS' ? 'bg-slate-800 text-white border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <RefreshCw size={14} /> USER REQUESTS ({requests.length})
            </button>
            <button 
                onClick={() => setActiveTab('HOUSE')}
                className={`px-6 py-3 text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'HOUSE' ? 'bg-slate-800 text-white border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Shield size={14} /> HOUSE TREASURY
            </button>
            <button 
                onClick={() => setActiveTab('SYSTEM')}
                className={`px-6 py-3 text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'SYSTEM' ? 'bg-slate-800 text-white border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Activity size={14} /> SYSTEM HEALTH
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-950 p-6 relative z-10">
            
            {activeTab === 'WITHDRAWALS' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-slate-400 text-sm uppercase">Pending Withdrawals</h3>
                        <button onClick={fetchRequests} className="text-blue-400 hover:text-white text-xs flex items-center gap-1">
                            <RefreshCw size={12} /> Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-20 text-slate-600">Scanning ledger...</div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-20 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
                            <p className="text-slate-500">No pending withdrawals.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {requests.map(req => (
                                <div key={req.id} className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-col md:flex-row justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-white font-bold">{req.userName}</span>
                                            <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-800 rounded">{shortenAddress(req.userId)}</span>
                                        </div>
                                        <div className="text-2xl font-bold text-yellow-500 mb-2">{formatCurrency(req.amount)}</div>
                                        <div className="text-xs text-slate-400 font-mono bg-slate-950 p-2 rounded border border-slate-800 flex items-center gap-2">
                                            <span>TO: {req.walletAddress || 'UNKNOWN WALLET'}</span>
                                            <button className="hover:text-white"><Copy size={12} /></button>
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-1">Requested: {new Date(req.timestamp).toLocaleString()}</p>
                                    </div>

                                    <div className="flex flex-col gap-2 min-w-[300px]">
                                        <div className="text-[10px] text-slate-500 uppercase">Process Request</div>
                                        {/* Admin Action Area */}
                                        <div className="bg-slate-950 p-3 rounded border border-slate-800">
                                            <input 
                                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white mb-2 focus:border-blue-500 focus:outline-none"
                                                placeholder="Paste TX Hash after sending SOL..."
                                                value={processingId === req.id ? adminTxHash : ''}
                                                onChange={(e) => {
                                                    setProcessingId(req.id);
                                                    setAdminTxHash(e.target.value);
                                                }}
                                            />
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleApprove(req)}
                                                    disabled={processingId === req.id && !adminTxHash}
                                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-1 disabled:opacity-50"
                                                >
                                                    <CheckCircle size={14} /> APPROVE
                                                </button>
                                                <button 
                                                    onClick={() => handleReject(req)}
                                                    className="flex-1 bg-red-900/50 hover:bg-red-900 text-red-400 text-xs font-bold py-2 rounded border border-red-800 flex items-center justify-center gap-1"
                                                >
                                                    <XCircle size={14} /> REJECT (REFUND)
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'HOUSE' && (
                <div className="flex flex-col items-center justify-center h-full">
                    <div className="bg-slate-900 p-8 rounded-2xl border-2 border-slate-800 text-center shadow-xl max-w-md w-full">
                        <Shield className="text-slate-700 mx-auto mb-4" size={48} />
                        <h3 className="text-slate-400 text-sm uppercase tracking-widest mb-2">House Treasury</h3>
                        <div className="text-5xl font-bold text-white mb-6 font-display drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                            {formatCurrency(houseProfit)}
                        </div>
                        
                        <div className="bg-yellow-900/20 border border-yellow-700/30 p-4 rounded-lg text-left mb-6">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs text-yellow-200/80">
                                    <strong>Manual Settlement:</strong> Withdrawals here reset the in-game counter. 
                                    You must verify the actual wallet balance on Solscan separately.
                                </p>
                            </div>
                        </div>

                        <button 
                            onClick={handleHouseWithdraw}
                            disabled={houseProfit <= 0}
                            className="w-full bg-slate-100 hover:bg-white text-slate-900 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ExternalLink size={18} /> WITHDRAW TO COLD WALLET
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'SYSTEM' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Infrastructure Status */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                        <h3 className="flex items-center gap-2 text-white font-bold mb-4">
                            <Server size={18} className="text-purple-500"/> INFRASTRUCTURE
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <div>
                                    <div className="text-red-400 font-bold text-sm">Backend Game Loop</div>
                                    <div className="text-xs text-red-300/50">Running Client-Side (Insecure)</div>
                                </div>
                                <XCircle className="text-red-500" size={18} />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <div>
                                    <div className="text-red-400 font-bold text-sm">Database Sync</div>
                                    <div className="text-xs text-red-300/50">Using Mock Memory</div>
                                </div>
                                <XCircle className="text-red-500" size={18} />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <div>
                                    <div className="text-green-400 font-bold text-sm">Frontend UI</div>
                                    <div className="text-xs text-green-300/50">Production Ready</div>
                                </div>
                                <CheckCircle className="text-green-500" size={18} />
                            </div>
                        </div>
                    </div>

                    {/* Solana Status */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                        <h3 className="flex items-center gap-2 text-white font-bold mb-4">
                            <Database size={18} className="text-blue-500"/> SOLANA INTEGRATION
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                <div>
                                    <div className="text-yellow-400 font-bold text-sm">RPC Connection</div>
                                    <div className="text-xs text-yellow-300/50">Public Mainnet (Rate Limited)</div>
                                </div>
                                <AlertTriangle className="text-yellow-500" size={18} />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <div>
                                    <div className="text-red-400 font-bold text-sm">Payout Automator</div>
                                    <div className="text-xs text-red-300/50">Manual Admin Process</div>
                                </div>
                                <XCircle className="text-red-500" size={18} />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <div>
                                    <div className="text-green-400 font-bold text-sm">Anti-Snipe Check</div>
                                    <div className="text-xs text-green-300/50">Active</div>
                                </div>
                                <CheckCircle className="text-green-500" size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 bg-blue-900/20 border border-blue-500/20 rounded-xl p-4 text-center">
                        <p className="text-blue-300 text-sm">
                            To go live, deploy a <strong>Node.js</strong> backend with <strong>Firebase Admin SDK</strong> and a private <strong>Helius RPC</strong> key.
                        </p>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
