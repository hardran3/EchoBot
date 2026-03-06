
import React from 'react';
import { Square, Activity, FileText, MessageSquare, Heart, RefreshCw } from 'lucide-react';
import { Identity, ProfileInfo } from '../types';
import { nip19 } from 'nostr-tools';

interface BotCardProps {
  bot: Identity;
  isRunning: boolean;
  onStop: (id: string) => void;
  sessionStats?: { replies: number, reactions: number, reposts: number, proactive: number };
  communityProfiles: Record<string, ProfileInfo>;
}

export const BotCard = React.memo(({ 
  bot, 
  isRunning, 
  onStop, 
  sessionStats, 
  communityProfiles 
}: BotCardProps) => {
  const targetPubkey = React.useMemo(() => {
    try {
      const decoded = nip19.decode(bot.settings.targetNpub) as any;
      return decoded.type === 'npub' ? (decoded.data as string) : '';
    } catch (e) { return ''; }
  }, [bot.settings.targetNpub]);

  const targetProfile = targetPubkey ? communityProfiles[targetPubkey] : null;

  return (
    <div className="p-2.5 bg-black/40 border border-emerald-500/10 rounded-xl group/bot flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative shrink-0">
          <img 
            src={bot.settings.profile.picture} 
            alt="" 
            className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/50 object-cover"
            crossOrigin="anonymous"
          />
          <div className="absolute -bottom-1 -right-1">
            {targetPubkey ? (
              <img 
                src={targetProfile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${targetPubkey}`} 
                alt="" 
                className="w-4 h-4 rounded-full bg-zinc-900 border border-black object-cover shadow-lg"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-zinc-900 border border-black flex items-center justify-center shadow-lg">
                <Activity className="w-2.5 h-2.5 text-emerald-500" />
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight">{bot.name}</p>
          <p className="text-[10px] text-zinc-500 truncate font-bold flex items-center gap-1 leading-tight">
            {targetPubkey ? (
              <>
                <span className="opacity-50 uppercase text-[8px] tracking-tighter">vs</span>
                <span className="text-emerald-500/80">{bot.settings.targetName || targetProfile?.name || bot.settings.targetNpub.substring(0, 8)}</span>
              </>
            ) : (
              <span className="text-emerald-500/60 uppercase text-[8px] tracking-widest">Self-Directed</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 px-3 py-1 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
        <div className="flex items-center gap-1.5" title="Original Notes">
          <FileText className="w-3 h-3 text-blue-500/60" />
          <span className="text-xs font-mono font-bold text-zinc-300">{sessionStats?.proactive || 0}</span>
        </div>
        <div className="flex items-center gap-1.5" title="Replies">
          <MessageSquare className="w-3 h-3 text-emerald-500/60" />
          <span className="text-xs font-mono font-bold text-zinc-300">{sessionStats?.replies || 0}</span>
        </div>
        <div className="flex items-center gap-1.5" title="Reactions">
          <Heart className="w-3 h-3 text-pink-500/60" />
          <span className="text-xs font-mono font-bold text-zinc-300">{sessionStats?.reactions || 0}</span>
        </div>
        <div className="flex items-center gap-1.5" title="Reposts">
          <RefreshCw className="w-3 h-3 text-purple-500/60" />
          <span className="text-xs font-mono font-bold text-zinc-300">{sessionStats?.reposts || 0}</span>
        </div>
      </div>

      <button 
        onClick={() => onStop(bot.id)}
        className="p-2 hover:bg-red-500/20 text-zinc-700 hover:text-red-400 transition-all rounded-lg shrink-0 group-hover/bot:bg-zinc-800/50"
        title="Stop this bot"
      >
        <Square className="w-3.5 h-3.5 fill-current" />
      </button>
    </div>
  );
});
