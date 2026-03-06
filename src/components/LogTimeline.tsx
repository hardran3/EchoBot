
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { LogEntry, ProfileInfo } from '../types';
import { cn } from '../types';
import { nip19 } from 'nostr-tools';

interface LogTimelineProps {
  logs: LogEntry[];
  isVerbose: boolean;
  setIsVerbose: (v: boolean) => void;
  onClear: () => void;
  communityProfiles: Record<string, ProfileInfo>;
}

export const LogTimeline = React.memo(({ 
  logs, 
  isVerbose, 
  setIsVerbose, 
  onClear, 
  communityProfiles 
}: LogTimelineProps) => {
  const filteredLogs = logs.filter(log => isVerbose || log.type !== 'info');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-zinc-800/30 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={isVerbose}
                onChange={(e) => setIsVerbose(e.target.checked)}
              />
              <div className={cn(
                "w-6 h-3 rounded-full transition-colors",
                isVerbose ? "bg-emerald-500/50" : "bg-zinc-700"
              )}></div>
              <div className={cn(
                "absolute -left-1 -top-1 w-5 h-5 rounded-full transition-transform shadow-lg",
                isVerbose ? "translate-x-3 bg-emerald-400" : "translate-x-0 bg-zinc-500"
              )}></div>
            </div>
            <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold group-hover:text-zinc-300 transition-colors">Verbose</span>
          </label>
        </div>
        <button 
          onClick={onClear}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold flex items-center gap-1.5"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px] custom-scrollbar">
        <AnimatePresence initial={false}>
          {filteredLogs.map((log) => (
            <LogItem key={log.id} log={log} profile={log.pubkey ? communityProfiles[log.pubkey] : undefined} />
          ))}
        </AnimatePresence>
        {filteredLogs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-2 opacity-50">
            <Activity className="w-8 h-8" />
            <p className="italic text-sm text-center">Timeline is empty. Start the bot to begin monitoring.</p>
          </div>
        )}
      </div>
    </div>
  );
});

const LogItem = React.memo(({ log, profile }: { log: LogEntry, profile?: ProfileInfo }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    className={cn(
      "flex items-center gap-3 p-2 rounded-lg border transition-all group",
      log.type === 'info' && "bg-zinc-800/10 border-zinc-800/30 text-zinc-500",
      log.type === 'success' && "bg-emerald-500/5 border-emerald-500/10 text-emerald-400/90",
      log.type === 'warning' && "bg-amber-500/5 border-amber-500/10 text-amber-400/90",
      log.type === 'error' && "bg-red-500/5 border-red-500/10 text-red-400/90"
    )}
  >
    <span className="text-[10px] font-mono font-bold opacity-40 shrink-0 min-w-[55px]">
      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
    </span>

    {log.pubkey && (
      <div className="shrink-0 flex items-center gap-2">
        <img 
          src={profile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${log.pubkey}`} 
          alt="" 
          className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700/50"
          crossOrigin="anonymous"
        />
        <span className="text-[10px] font-black tracking-tight whitespace-nowrap opacity-80 max-w-[80px] truncate">
          {profile?.name || `${nip19.npubEncode(log.pubkey).substring(0, 8)}`}
        </span>
      </div>
    )}

    <div className="flex-1 min-w-0 flex items-center gap-2">
      <span className="text-[11px] truncate">{log.message}</span>
    </div>

    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
      {log.type === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
      {log.type === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
    </div>
  </motion.div>
));
