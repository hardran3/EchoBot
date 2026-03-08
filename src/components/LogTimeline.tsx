
import React, { useMemo } from 'react';
import { Activity, Trash2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { LogEntry, ProfileInfo, Identity } from '../types';
import { cn } from '../types';
import { nip19 } from 'nostr-tools';

interface LogTimelineProps {
  logs: LogEntry[];
  isVerbose: boolean;
  setIsVerbose: (v: boolean) => void;
  onClear: () => void;
  communityProfiles: Record<string, ProfileInfo>;
  savedIdentities: Identity[];
  hideVerboseToggle?: boolean;
}

export const LogTimeline = React.memo(({ 
  logs, 
  isVerbose, 
  setIsVerbose, 
  onClear, 
  communityProfiles,
  savedIdentities,
  hideVerboseToggle = false
}: LogTimelineProps) => {
  const filteredLogs = logs.filter(log => isVerbose || log.type !== 'info');

  const groupedLogs = useMemo(() => {
    const groupsMap = new Map<string, LogEntry[]>();
    const standaloneLogs: LogEntry[] = [];

    // All events related to a specific target note should be groupable
    const DETECTION_PHRASES = ['New note from', 'New note matching', 'New mention from', 'New reaction from'];
    const ACTION_PHRASES = ['Replied:', 'Reacted with', 'Reposted note'];

    filteredLogs.forEach((log) => {
      const isDetection = DETECTION_PHRASES.some(p => log.message.includes(p));
      const isAction = ACTION_PHRASES.some(p => log.message.includes(p));
      const isGroupable = isDetection || isAction;
      
      if (log.targetEventId && isGroupable) {
        const group = groupsMap.get(log.targetEventId) || [];
        group.push(log);
        groupsMap.set(log.targetEventId, group);
      } else {
        standaloneLogs.push(log);
      }
    });

    const allItems: (LogEntry | LogEntry[])[] = [
      ...Array.from(groupsMap.values()),
      ...standaloneLogs
    ];

    // Sort all items by the timestamp of their most recent log entry
    return allItems.sort((a, b) => {
      const timeA = Array.isArray(a) ? a[0].timestamp : a.timestamp;
      const timeB = Array.isArray(b) ? b[0].timestamp : b.timestamp;
      return timeB - timeA;
    });
  }, [filteredLogs]);

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
        {groupedLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-20 space-y-2">
            <Activity className="w-10 h-10" />
            <p className="text-xs font-bold uppercase tracking-widest">Waiting for activity...</p>
          </div>
        ) : (
          <div className="divide-y divide-outline/5">
            {groupedLogs.map((item, idx) => {
              if (Array.isArray(item)) {
                return (
                  <LogItemGroup 
                    key={item[0].id} 
                    logs={item} 
                    communityProfiles={communityProfiles}
                    savedIdentities={savedIdentities}
                  />
                );
              }
              return (
                <LogItem 
                  key={item.id} 
                  log={item} 
                  profile={item.pubkey ? communityProfiles[item.pubkey] : undefined} 
                  communityProfiles={communityProfiles}
                  savedIdentities={savedIdentities}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

const LogItemGroup = React.memo(({ logs, communityProfiles, savedIdentities }: { 
  logs: LogEntry[], 
  communityProfiles: Record<string, ProfileInfo>,
  savedIdentities: Identity[]
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  const { uniqueBotCount, botAvatars, actionCount, actionLogs } = useMemo(() => {
    const bots = new Map<string, { id?: string, name?: string }>();
    const actions: LogEntry[] = [];

    // Engagement actions that should be explicitly shown
    const ACTION_PHRASES = ['Replied:', 'Reacted with', 'Reposted', 'Followed back', 'Posted original note:'];

    logs.forEach(l => {
      const key = l.botId || l.botName || 'unknown';
      if (!bots.has(key)) {
        bots.set(key, { id: l.botId, name: l.botName });
      }

      const isAction = ACTION_PHRASES.some(p => l.message.includes(p));
      if (isAction) {
        actions.push(l);
      }
    });

    return {
      uniqueBotCount: bots.size,
      botAvatars: Array.from(bots.values()),
      actionCount: actions.length,
      actionLogs: actions
    };
  }, [logs]);

  const firstLog = logs[0];
  const profile = firstLog.contextPubkey ? communityProfiles[firstLog.contextPubkey] : undefined;

  return (
    <div className="flex flex-col px-3 py-2 transition-all group hover:bg-surface-container-low border-l-4 border-emerald-500/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-on-surface-variant/60">
            {new Date(firstLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </span>
          <div className="flex -space-x-2 overflow-hidden">
            {botAvatars.map((botInfo, i) => {
              const bot = savedIdentities.find(identity => identity.id === botInfo.id);
              const botProfile = bot?.settings.profile;
              return (
                <img 
                  key={i}
                  src={botProfile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${botInfo.id || botInfo.name}`} 
                  alt={botInfo.name} 
                  className="inline-block h-5 w-5 rounded-sm ring-2 ring-surface object-cover bg-surface-container-high"
                  title={botInfo.name}
                  crossOrigin="anonymous"
                />
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">
              {uniqueBotCount} Monitoring
            </span>
            {actionCount > 0 && (
              <>
                <span className="text-[10px] text-on-surface-variant/40">•</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-emerald-500/20 px-1 rounded-xs">
                  {actionCount} Action{actionCount !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>
        {actionCount > 0 && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] font-black uppercase tracking-tighter text-on-surface-variant hover:text-emerald-500 transition-colors flex items-center gap-1 bg-surface-container-high px-1.5 py-0.5 rounded-sm border border-outline/10 shadow-sm"
          >
            {isExpanded ? 'Hide' : 'Show'} Actions
            <Activity className={cn("w-3 h-3 transition-transform", isExpanded ? "rotate-180" : "")} />
          </button>
        )}
      </div>

      {firstLog.contextContent && (
        <div className="px-3 py-2 bg-surface border-l-2 border-outline/20 mb-2 opacity-60 ml-2">
          {firstLog.contextPubkey && (
            <div className="flex items-center gap-1.5 mb-1 opacity-80">
              <img 
                src={profile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${firstLog.contextPubkey}`} 
                alt="" 
                className="w-3.5 h-3.5 rounded-none object-cover grayscale"
                crossOrigin="anonymous"
              />
              <span className="text-[10px] font-black uppercase tracking-tighter text-on-surface-variant">
                {profile?.name || (firstLog.contextPubkey ? nip19.npubEncode(firstLog.contextPubkey).substring(0, 10) + '...' : 'Unknown')}
              </span>
            </div>
          )}
          <p className="text-xs leading-relaxed italic text-on-surface-variant line-clamp-2">
            {firstLog.contextContent}
          </p>
        </div>
      )}

      {isExpanded && actionLogs.length > 0 && (
        <div className="space-y-1.5 ml-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {actionLogs.map((log) => (
            <div key={log.id} className="flex items-center gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
              <LogItemContent 
                log={log} 
                communityProfiles={communityProfiles} 
                savedIdentities={savedIdentities}
                compact
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const LogItemContent = ({ log, communityProfiles, savedIdentities, compact = false }: { 
  log: LogEntry, 
  communityProfiles: Record<string, ProfileInfo>,
  savedIdentities: Identity[],
  compact?: boolean
}) => {
  const renderMessage = (message: string) => {
    // If compact, strip the [BotName] prefix as it's already in the header
    let displayMessage = message;
    if (compact) {
      displayMessage = message.replace(/^\[[^\]]+\]\s*/, '');
    }

    // 1. Bot Name Parsing: [BotName]
    const botRegex = /\[([^\]]+)\]/g;
    // 2. Nostr Regex: hex pubkeys (64 chars) and npubs (starts with npub1)
    const nostrRegex = /(npub1[a-z0-9]{58}|[a-f0-9]{64})/gi;
    
    // Combine splitting for both
    const parts = displayMessage.split(/(\[[^\]]+\]|npub1[a-z0-9]{58}|[a-f0-9]{64})/gi);
    
    if (parts.length === 1) return displayMessage;

    return parts.map((part, i) => {
      // Match [BotName]
      if (part.match(botRegex)) {
        const botName = part.slice(1, -1);
        const bot = savedIdentities.find(idx => idx.name === botName || idx.settings.profile.name === botName);
        const botProfile = bot?.settings.profile;

        return (
          <span key={i} className="inline-flex items-center gap-1.5 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-sm mx-0.5 align-middle shadow-sm">
            <img 
              src={botProfile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${bot?.id || botName}`} 
              alt="" 
              className="w-3.5 h-3.5 rounded-none object-cover"
              crossOrigin="anonymous"
            />
            <span className="text-[11px] font-black uppercase tracking-tight text-emerald-500 truncate max-w-[100px]">
              {botName}
            </span>
          </span>
        );
      }

      // Match Nostr Identity
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
      "text-sm leading-snug break-words font-medium flex-1",
      log.type === 'error' ? "text-red-400" :
      log.type === 'warning' ? "text-amber-400" :
      "text-on-surface"
    )}>
      {renderMessage(log.message)}
    </div>
  );
};

const LogItem = React.memo(({ log, profile, communityProfiles, savedIdentities }: { 
  log: LogEntry, 
  profile?: ProfileInfo, 
  communityProfiles: Record<string, ProfileInfo>,
  savedIdentities: Identity[]
}) => {
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
            {log.botId ? (() => {
              const bot = savedIdentities.find(i => i.id === log.botId);
              const botProfile = bot?.settings.profile;
              return (
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-sm shadow-sm">
                  <img 
                    src={botProfile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${log.botId}`} 
                    alt="" 
                    className="w-3.5 h-3.5 rounded-none object-cover"
                    crossOrigin="anonymous"
                  />
                  <span className="text-[11px] font-black uppercase tracking-tight text-emerald-500 truncate max-w-[100px]">
                    {botProfile?.name || log.botName || 'Bot'}
                  </span>
                </div>
              );
            })() : log.botName && (
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
              <LogItemContent 
                log={log} 
                communityProfiles={communityProfiles} 
                savedIdentities={savedIdentities} 
              />
            </p>
          </div>
        )}

        <LogItemContent 
          log={log} 
          communityProfiles={communityProfiles} 
          savedIdentities={savedIdentities} 
        />
      </div>
    </div>
  );
});
