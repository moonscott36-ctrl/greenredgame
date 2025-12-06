import React from 'react';
import { Clock, AlertTriangle } from './Icons';
import { calculateCurrentTax } from '../utils/gameMath';
import { LATE_GAME_START } from '../constants';

interface TimerDisplayProps {
  timeLeft: number;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ timeLeft }) => {
  const tax = calculateCurrentTax(timeLeft);
  const taxPercentage = (tax * 100).toFixed(1);
  const isHighStakes = timeLeft <= LATE_GAME_START;
  
  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className={`relative p-0.5 rounded-lg overflow-hidden transition-all duration-300 ${isHighStakes ? 'animate-pulse-glow-red' : 'shadow-lg shadow-blue-900/20'}`}>
       {/* Border Gradient */}
       <div className={`absolute inset-0 ${isHighStakes ? 'bg-gradient-to-br from-red-600 to-orange-600' : 'bg-gradient-to-br from-slate-700 to-slate-800'}`}></div>
       
       <div className="relative bg-slate-900/90 backdrop-blur rounded-[6px] p-2 flex flex-col items-center justify-center border border-white/5">
          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

          <div className="flex items-center justify-center w-full gap-3 mb-1.5">
            <div className="flex items-center space-x-2">
              <Clock className={isHighStakes ? "text-red-500 animate-bounce" : "text-blue-400"} size={16} />
              <span className={`text-3xl md:text-4xl font-display tracking-widest leading-none ${isHighStakes ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'text-white drop-shadow-md'}`}>
                {timeString}
              </span>
            </div>

            <div className={`px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold flex items-center gap-1 border shadow-inner transition-colors duration-300
                ${isHighStakes 
                    ? 'bg-red-500 text-white border-red-400 animate-pulse' 
                    : 'bg-slate-800 text-green-400 border-slate-600'
                }`}>
              {isHighStakes && <AlertTriangle size={8} className="fill-current" />}
              FEE: {taxPercentage}%
            </div>
          </div>
          
          {/* Fee Progress Bar */}
          <div className="w-full relative px-1">
            <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                <div 
                    className={`h-full transition-all duration-300 striped-bg ${isHighStakes ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${(tax / 0.5) * 100}%` }}
                />
            </div>
            <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase mt-0.5">
                <span>Safe</span>
                <span>Danger (50%)</span>
            </div>
          </div>
      </div>
    </div>
  );
};