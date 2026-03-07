
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
    <div className="p-2 bg-surface-container-high border border-outline/5 rounded-sm group/bot flex items-center justify-between gap-3 shadow-sm hover:border-emerald-500/20 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="relative shrink-0">
          <img 
            src={bot.settings.profile.picture} 
            alt="" 
            className="w-8 h-8 rounded-sm bg-surface border border-outline/10 object-cover"
            crossOrigin="anonymous"
          />
          <div className="absolute -bottom-1 -right-1">
            {targetPubkey ? (
              <img 
                src={targetProfile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${targetPubkey}`} 
                alt="" 
                className="w-4 h-4 rounded-sm bg-surface border border-black object-cover shadow-md"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-4 h-4 rounded-sm bg-surface border border-black flex items-center justify-center shadow-md">
                <Activity className="w-2.5 h-2.5 text-emerald-500" />
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-on-surface truncate leading-tight">{bot.name}</p>
          <p className="text-xs text-on-surface-variant truncate font-bold flex items-center gap-1 leading-tight">
            {targetPubkey ? (
              <>
                <span className="uppercase text-[11px] tracking-tighter">vs</span>
                <span className="text-emerald-500/90">{bot.settings.targetName || targetProfile?.name || bot.settings.targetNpub.substring(0, 8)}</span>
              </>
            ) : (
              <span className="text-emerald-500/80 uppercase text-[11px] tracking-widest">Self-Directed</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 px-2 py-1 bg-surface border border-outline/5 rounded-sm">
        <div className="flex items-center gap-1" title="Original Notes">
          <FileText className="w-3 h-3 text-blue-400/70" />
          <span className="text-xs font-mono font-bold text-on-surface-variant">{sessionStats?.proactive || 0}</span>
        </div>
        <div className="flex items-center gap-1" title="Replies">
          <MessageSquare className="w-3 h-3 text-emerald-400/70" />
          <span className="text-xs font-mono font-bold text-on-surface-variant">{sessionStats?.replies || 0}</span>
        </div>
        <div className="flex items-center gap-1" title="Reactions">
          <Heart className="w-3 h-3 text-pink-400/70" />
          <span className="text-xs font-mono font-bold text-on-surface-variant">{sessionStats?.reactions || 0}</span>
        </div>
        <div className="flex items-center gap-1" title="Reposts">
          <RefreshCw className="w-3 h-3 text-purple-400/70" />
          <span className="text-xs font-mono font-bold text-on-surface-variant">{sessionStats?.reposts || 0}</span>
        </div>
      </div>

      <button 
        onClick={() => onStop(bot.id)}
        className="p-1.5 hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 transition-all rounded-sm shrink-0"
        title="Stop this bot"
      >
        <Square className="w-3.5 h-3.5 fill-current opacity-40 hover:opacity-100" />
      </button>
    </div>
  );
});
