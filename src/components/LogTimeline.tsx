
import React from 'react';
import { Activity, Trash2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { LogEntry, ProfileInfo } from '../types';
import { cn } from '../types';
import { nip19 } from 'nostr-tools';

interface LogTimelineProps {
  logs: LogEntry[];
  isVerbose: boolean;
  setIsVerbose: (v: boolean) => void;
  onClear: () => void;
  communityProfiles: Record<string, ProfileInfo>;
  hideVerboseToggle?: boolean;
}

export const LogTimeline = React.memo(({ 
  logs, 
  isVerbose, 
  setIsVerbose, 
  onClear, 
  communityProfiles,
  hideVerboseToggle = false
}: LogTimelineProps) => {
  const filteredLogs = logs.filter(log => isVerbose || log.type !== 'info');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface">
      {/* Feed Header */}
      <div className="px-3 py-2 border-b border-outline/10 flex items-center justify-between bg-surface-container-low shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Live Activity Feed</h2>
        </div>
        <div className="flex items-center gap-3">
          {!hideVerboseToggle && (
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={isVerbose}
                  onChange={(e) => setIsVerbose(e.target.checked)}
                />
                <div className={cn(
                  "w-7 h-3.5 rounded-full transition-colors border border-outline/20",
                  isVerbose ? "bg-emerald-500/30" : "bg-surface-container-high"
                )}></div>
                <div className={cn(
                  "absolute -left-0.5 -top-0.5 w-4.5 h-4.5 rounded-sm transition-transform shadow-md border border-outline/30",
                  isVerbose ? "translate-x-3 bg-emerald-400" : "translate-x-0 bg-on-surface-variant"
                )}></div>
              </div>
              <span className="text-xs text-on-surface-variant uppercase tracking-wider font-bold group-hover:text-on-surface transition-colors">Verbose</span>
            </label>
          )}
          <button 
            onClick={onClear}
            className="p-1 hover:bg-surface-container-high rounded-sm text-on-surface-variant hover:text-red-400 transition-all border border-transparent hover:border-outline/10"
            title="Clear Logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-20 space-y-2">
            <Activity className="w-10 h-10" />
            <p className="text-xs font-bold uppercase tracking-widest">Waiting for activity...</p>
          </div>
        ) : (
          <div className="divide-y divide-outline/5">
            {filteredLogs.map((log) => (
              <LogItem 
                key={log.id} 
                log={log} 
                profile={log.pubkey ? communityProfiles[log.pubkey] : undefined} 
                communityProfiles={communityProfiles}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

const LogItem = React.memo(({ log, profile, communityProfiles }: { log: LogEntry, profile?: ProfileInfo, communityProfiles: Record<string, ProfileInfo> }) => {
  const renderMessage = (message: string) => {
    // Improved Regex for hex pubkeys (64 chars) and npubs (starts with npub1)
    const nostrRegex = /(npub1[a-z0-9]{58}|[a-f0-9]{64})/gi;
    const parts = message.split(nostrRegex);
    
    if (parts.length === 1) return message;

    return parts.map((part, i) => {
      if (part.match(nostrRegex)) {
        let pk = part.toLowerCase();
        let npub = part.toLowerCase();
        
        try {
          if (part.startsWith('npub1')) {
            const decoded = nip19.decode(part) as any;
            if (decoded.type === 'npub') pk = decoded.data;
          } else {
            npub = nip19.npubEncode(part);
          }
        } catch (e) {
          // If it matched the regex but decoding failed (e.g. invalid checksum), just return text
          return part;
        }

        const p = communityProfiles[pk];
        
        return (
          <span key={i} className="inline-flex items-center gap-1.5 px-1.5 py-0.5 bg-surface-container border border-outline/10 rounded-sm mx-0.5 align-middle shadow-sm">
            <img 
              src={p?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${pk}`} 
              alt="" 
              className="w-3.5 h-3.5 rounded-none object-cover"
              crossOrigin="anonymous"
            />
            <span className={cn(
              "text-[11px] font-black uppercase tracking-tight truncate max-w-[120px]",
              p?.name ? "text-emerald-400" : "text-on-surface-variant/60"
            )}>
              {p?.name ? `@${p.name}` : npub.substring(0, 10) + '...'}
            </span>
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn(
      "flex items-start gap-3 px-3 py-2 transition-all group hover:bg-surface-container-low",
      log.type === 'info' && "text-on-surface-variant/70",
      log.type === 'success' && "bg-emerald-500/[0.03] text-emerald-400/90",
      log.type === 'warning' && "bg-amber-500/[0.03] text-amber-400/90",
      log.type === 'error' && "bg-red-500/[0.03] text-red-400/90"
    )}>
      <div className="shrink-0 mt-1 flex flex-col items-center gap-1">
        {log.pubkey ? (
          <img 
            src={profile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${log.pubkey}`} 
            alt="" 
            className="w-6 h-6 rounded-sm bg-surface-container-high border border-outline/10 object-cover shadow-sm"
            crossOrigin="anonymous"
          />
        ) : (
          <div className={cn(
            "w-6 h-6 rounded-sm flex items-center justify-center border shadow-sm",
            log.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" :
            log.type === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
            "bg-surface-container-high border-outline/10 text-emerald-500/60"
          )}>
            <Activity className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-on-surface-variant/80 shrink-0">
              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
            {log.botName && (
              <span className="text-xs font-black uppercase tracking-tighter text-emerald-500 px-1.5 border border-emerald-500/20 rounded-sm bg-emerald-500/5 truncate">
                {log.botName}
              </span>
            )}
            {log.pubkey && profile?.name && (
              <span className="text-xs font-bold text-on-surface-variant/80 truncate">
                @{profile.name}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {log.eventId && (
              <a 
                href={`https://njump.me/${nip19.neventEncode({ id: log.eventId, relays: log.relays })}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-surface-container-high rounded-sm text-on-surface-variant hover:text-emerald-500 transition-colors border border-transparent hover:border-outline/10"
                title="View on njump"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {log.type === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-500/60" />}
            {log.type === 'error' && <AlertCircle className="w-3 h-3 text-red-500/60" />}
          </div>
        </div>

        {log.contextContent && (
          <div className="px-3 py-2 bg-surface border-l-2 border-outline/20 mb-1.5 opacity-60">
            {log.contextPubkey && (
              <div className="flex items-center gap-1.5 mb-1 opacity-80">
                <img 
                  src={communityProfiles[log.contextPubkey]?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${log.contextPubkey}`} 
                  alt="" 
                  className="w-3.5 h-3.5 rounded-none object-cover grayscale"
                  crossOrigin="anonymous"
                />
                <span className="text-[10px] font-black uppercase tracking-tighter text-on-surface-variant">
                  {communityProfiles[log.contextPubkey]?.name || nip19.npubEncode(log.contextPubkey).substring(0, 10) + '...'}
                </span>
              </div>
            )}
            <p className="text-xs leading-relaxed italic text-on-surface-variant line-clamp-3">
              {renderMessage(log.contextContent)}
            </p>
          </div>
        )}

        <div className={cn(
          "text-sm leading-snug break-words font-medium",
          log.type === 'error' ? "text-red-400" :
          log.type === 'warning' ? "text-amber-400" :
          "text-on-surface"
        )}>
          {renderMessage(log.message)}
        </div>
      </div>
    </div>
  );
});
