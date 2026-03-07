
import { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  pubkey?: string;
  botName?: string;
  botId?: string;
  eventId?: string;
  targetEventId?: string;
  relays?: string[];
  contextContent?: string;
  contextPubkey?: string;
}

export interface ProfileInfo {
  name: string;
  about: string;
  picture: string;
  nip05: string;
  lud16?: string;
  lud06?: string;
}

export interface BotStats {
  repliesSent: Record<string, number>;
  reactionsSent: Record<string, number>;
  repostsSent: Record<string, number>;
  proactiveNotesSent: Record<string, number>;
  repliesReceived: Record<string, number>;
  reactionsReceived: Record<string, number>;
}

export interface ProactiveSettings {
  enabled: boolean;
  interval: number; // minutes, 0 for disabled
  inspiration: 'target' | 'follows' | 'both';
  replyToMentions: boolean;
  replyProbability: number; // 0.0 to 1.0
  aiPostPrompt: string;
}

export interface Identity {
  id: string;
  name: string;
  settings: BotSettings;
  nsec: string;
  npub?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  stats?: BotStats;
  lastProactivePost?: number; // timestamp
  nextProactiveTimestamp?: number; // timestamp with jitter
}

export interface BotSettings {
  minDelay: number; // seconds
  maxDelay: number; // seconds
  targetNpub: string;
  targetName: string;
  messages: string[];
  profile: ProfileInfo;
  reactToNotes: boolean;
  reactionEmojis: string;
  repostNotes: boolean;
  repostChance: number; // 0.0 to 1.0
  autoFollowBack: boolean;
  useAI: boolean;
  aiSystemPrompt: string;
  modelId: string;
  // Inference Parameters
  temperature: number;
  top_p: number;
  top_k: number;
  repetition_penalty: number;
  presence_penalty: number;
  frequency_penalty: number;
  relays?: string[];
  proactive: ProactiveSettings;
}

export interface BotTask {
  id: string;
  botId?: string;
  execute: () => Promise<void>;
  description: string;
}

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: any) => Promise<any>;
      nip44?: {
        encrypt: (peer: string, plaintext: string) => Promise<string>;
        decrypt: (peer: string, ciphertext: string) => Promise<string>;
      };
    };
  }
}
