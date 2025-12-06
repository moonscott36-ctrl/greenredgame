import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Activity } from './Icons';

interface ActivityFeedProps {
  logs: LogEntry[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700 h-64 flex flex-col">
      <div className="p-3 border-b border-slate-700 flex items-center gap-2 text-slate-300">
        <Activity size={16} />
        <span className="text-xs font-bold uppercase">Live Activity</span>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-1 scroll-smooth"
      >
        {logs.length === 0 && (
            <div className="text-center text-slate-600 text-sm mt-10">Waiting for bets...</div>
        )}
        {logs.map((log) => (
          <div 
            key={log.id} 
            className={`text-xs p-2 rounded border-l-2 animate-in fade-in slide-in-from-bottom-1 duration-200
              ${log.type === 'GREEN' ? 'border-green-500 bg-green-900/10 text-green-200' : ''}
              ${log.type === 'RED' ? 'border-red-500 bg-red-900/10 text-red-200' : ''}
              ${log.type === 'INFO' ? 'border-blue-500 bg-blue-900/10 text-blue-200' : ''}
              ${log.type === 'ALERT' ? 'border-yellow-500 bg-yellow-900/10 text-yellow-200 font-bold' : ''}
            `}
          >
            <span className="opacity-50 mr-2 font-mono">
                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
            </span>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
};