import React from 'react';
import { formatCurrency, formatUSD } from '../utils/gameMath';
import { Trophy, Skull } from 'lucide-react';

interface PoolBarProps {
  greenPool: number;
  redPool: number;
  solPrice: number;
}

export const PoolBar: React.FC<PoolBarProps> = ({ greenPool, redPool, solPrice }) => {
  const total = greenPool + redPool;
  // Default to 50% if pool is empty to show balanced bar
  const greenPercent = total === 0 ? 50 : (greenPool / total) * 100;
  const redPercent = total === 0 ? 50 : (redPool / total) * 100;

  return (
    <div className="w-full mb-8 relative">
      {/* Top Labels */}
      <div className="flex justify-between mb-2 items-end">
        <div className="flex flex-col items-start">
          <span className="text-green-400 font-display text-sm tracking-wider flex items-center gap-1">
            <Trophy size={14} /> GREEN TEAM
          </span>
          <span className="text-3xl font-display text-white drop-shadow-lg">{formatCurrency(greenPool)}</span>
          <span className="text-xs font-mono text-green-500/70">~{formatUSD(greenPool * solPrice)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-red-400 font-display text-sm tracking-wider flex items-center gap-1">
            RED TEAM <Skull size={14} />
          </span>
          <span className="text-3xl font-display text-white drop-shadow-lg">{formatCurrency(redPool)}</span>
          <span className="text-xs font-mono text-red-500/70">~{formatUSD(redPool * solPrice)}</span>
        </div>
      </div>

      {/* The Bar */}
      <div className="h-16 w-full bg-slate-900 rounded-2xl overflow-hidden flex shadow-[0_0_20px_rgba(0,0,0,0.5)] border-4 border-slate-800 relative z-10">

        {/* Green Side */}
        <div
          className="h-full bg-gradient-to-b from-green-500 to-green-700 transition-all duration-500 flex items-center justify-start pl-4 relative striped-bg"
          style={{ width: `${greenPercent}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20"></div>
          <span className="text-white font-black text-xl drop-shadow-md z-10 relative">{greenPercent.toFixed(0)}%</span>
        </div>

        {/* VS Badge (Absolute Center) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-slate-800 rounded-full p-1 border-4 border-slate-700 shadow-xl">
          <div className="bg-slate-900 rounded-full w-10 h-10 flex items-center justify-center border border-white/10">
            <span className="font-display text-white font-bold italic text-sm text-yellow-500">VS</span>
          </div>
        </div>

        {/* Red Side */}
        <div
          className="h-full bg-gradient-to-b from-red-500 to-red-700 transition-all duration-500 flex items-center justify-end pr-4 relative striped-bg"
          style={{ width: `${redPercent}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/20"></div>
          <span className="text-white font-black text-xl drop-shadow-md z-10 relative">{redPercent.toFixed(0)}%</span>
        </div>
      </div>

      {/* Bottom Context Info */}
      <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
        <span className="bg-slate-800/50 px-2 py-1 rounded">Pays out + 50% Red Share</span>
        <span className="bg-slate-800/50 px-2 py-1 rounded text-right">Pays out + 100% Green + JACKPOT</span>
      </div>
    </div>
  );
};