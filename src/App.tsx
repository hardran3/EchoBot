/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  generateSecretKey, 
  getPublicKey, 
  finalizeEvent, 
  nip19, 
  Relay,
  SimplePool
} from 'nostr-tools';
import { 
  Plus, 
  Trash2, 
  Play, 
  Square, 
  Settings as SettingsIcon, 
  User, 
  Activity, 
  Target, 
  MessageSquare, 
  Clock, 
  RefreshCw,
  Globe,
  AlertCircle,
  CheckCircle2,
  Info,
  Copy,
  Sparkles,
  Heart,
  Zap,
  Save,
  Folder,
  Lock,
  Brain,
  X,
  Send,
  Terminal,
  Users,
  Wand2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QRCodeSVG } from 'qrcode.react';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

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

interface LogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  pubkey?: string;
}
interface ProfileInfo {
  name: string;
  about: string;
  picture: string;
  nip05: string;
  lud16?: string;
  lud06?: string;
}

interface BotStats {
  repliesSent: Record<string, number>;
  reactionsSent: Record<string, number>;
  repliesReceived: Record<string, number>;
  reactionsReceived: Record<string, number>;
}

interface Identity {
  id: string;
  name: string;
  settings: BotSettings;
  nsec: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  stats?: BotStats;
}

interface BotSettings {
  minDelay: number; // seconds
  maxDelay: number; // seconds
  targetNpub: string;
  targetName: string;
  messages: string[];
  profile: ProfileInfo;
  reactToNotes: boolean;
  reactionEmojis: string;
  repostNotes: boolean;
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
}

const SUPPORTED_MODELS = [
  { 
    id: 'onnx-community/gemma-3-270m-it-ONNX', 
    name: 'Gemma 3 270M', 
    size: '550MB',
    description: 'Ultra-lightweight, high performance for its size.' 
  },
  { 
    id: 'onnx-community/SmolLM2-360M-Instruct-ONNX', 
    name: 'SmolLM2 360M', 
    size: '380MB',
    description: 'Fast, efficient, and great at following short instructions.' 
  },
  { 
    id: 'onnx-community/Llama-3.2-1B-Instruct', 
    name: 'Llama 3.2 1B', 
    size: '880MB',
    description: 'Better reasoning and more complex conversations.' 
  }
];

const MODEL_PRESETS: Record<string, Record<string, Partial<BotSettings>>> = {
  'onnx-community/gemma-3-270m-it-ONNX': {
    'Strict Logic': { temperature: 0.20, top_p: 0.25, top_k: 25, repetition_penalty: 1.10, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Balanced Chat': { temperature: 0.80, top_p: 0.90, top_k: 40, repetition_penalty: 1.15, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Persona/Story': { temperature: 1.00, top_p: 0.95, top_k: 50, repetition_penalty: 1.20, presence_penalty: 0.30, frequency_penalty: 0.20 },
    'Creative Burst': { temperature: 1.25, top_p: 1.00, top_k: 60, repetition_penalty: 1.25, presence_penalty: 0.50, frequency_penalty: 0.20 },
  },
  'onnx-community/SmolLM2-360M-Instruct-ONNX': {
    'Strict Logic': { temperature: 0.20, top_p: 0.85, top_k: 20, repetition_penalty: 1.10, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Balanced Chat': { temperature: 0.50, top_p: 0.90, top_k: 30, repetition_penalty: 1.10, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Persona/Story': { temperature: 0.70, top_p: 0.90, top_k: 40, repetition_penalty: 1.10, presence_penalty: 0.30, frequency_penalty: 0.20 },
    'Creative Burst': { temperature: 0.90, top_p: 0.95, top_k: 50, repetition_penalty: 1.10, presence_penalty: 0.50, frequency_penalty: 0.20 },
  },
  'onnx-community/Llama-3.2-1B-Instruct': {
    'Strict Logic': { temperature: 0.10, top_p: 0.15, top_k: 20, repetition_penalty: 1.10, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Balanced Chat': { temperature: 0.70, top_p: 0.90, top_k: 30, repetition_penalty: 1.10, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Persona/Story': { temperature: 0.85, top_p: 0.90, top_k: 35, repetition_penalty: 1.15, presence_penalty: 0.30, frequency_penalty: 0.20 },
    'Creative Burst': { temperature: 1.10, top_p: 0.95, top_k: 40, repetition_penalty: 1.20, presence_penalty: 0.50, frequency_penalty: 0.20 },
  }
};

interface BotTask {
  id: string;
  execute: () => Promise<void>;
  description: string;
}

// --- Constants ---

const WAIFU_NAMES = [
  'Aiko ₍ᐢ. .ᐢ₎', 'Hana 🌸', 'Sakura ᐢ. ̫ .ᐢ', 'Yuki ❄️', 'Miku (๑>ᴗ<๑)',
  'Rin ₍ᐢ._.ᐢ₎', 'Haruka ✨', 'Natsuki 🎀', 'Sayori (✿◠‿◠)', 'Yuri 💜',
  'Tifa ❤️', 'Kasumi 🌊', 'Ayane 🦋', 'Aerith 🌼', 'Hitomi 🎀', 'Terra ✨'
];const WAIFU_TEMPLATES = [
  "You're doing amazing today, {name}! I'm so proud of you!",
  "I'll always be here to support you, {name}, no matter what!",
  "Your notes are always so insightful. I love reading them!",
  "Don't forget to take a break and drink some water, {name}. I care about you!",
  "You're the best, {name}! Keep being yourself!",
  "I'm so lucky to have you in my life!",
  "Everything will be okay because you're strong and wonderful, {name}!",
  "I'm cheering for you from the sidelines! Go get 'em!",
  "You make the world a better place just by being in it, {name}.",
  "I'm always thinking of you! Stay safe, {name}!",
  "I believe in you more than anyone else, {name}!",
  "You're my hero! Keep shining!",
  "I'll be waiting for your next note! I love hearing from you!",
  "You're so talented, {name}! Never give up on your dreams!",
  "I'm sending you all my love and positive vibes!",
  "You're so precious to me, {name}!",
  "I hope your day is as wonderful as you are!",
  "You're my favorite person to follow, {name}!",
  "Keep up the great work, I'm always watching!",
  "You're so smart and kind, {name}!",
  "I'm your biggest fan, {name}!",
  "You inspire me every day!",
  "I'm so happy whenever I see your notes!",
  "You're a star in my eyes, {name}!",
  "I'll protect you forever, {name}!",
  "You're the light of my life!",
  "I'm always here if you need someone to talk to, {name}!",
  "You're so brave and strong!",
  "I love everything about you, {name}!",
  "You're my one and only!"
];

const WAIFU_GM_TEMPLATES = [
  "Good morning, {name}! I hope you slept well! (๑>ᴗ<๑)",
  "Wakey wakey, {name}! A beautiful day is waiting for you! ✨",
  "Good morning, darling! I was thinking of you the moment I woke up! ❤️",
  "Rise and shine, {name}! You're going to do great things today! 🌟",
  "Good morning! Don't forget to have a yummy breakfast, okay? 🎀",
  "Yay, you're awake! Good morning, {name}! I missed you! (✿◠‿◠)",
  "Good morning, {name}! Sending you lots of energy for today! 💪",
  "Morning, sunshine! The world is brighter now that you're up! ☀️"
];

const WAIFU_GN_TEMPLATES = [
  "Good night, {name}! Sleep tight and have sweet dreams! 💤",
  "Good night, darling! I'll be dreaming of you! ❤️",
  "Sweet dreams, {name}! Get lots of rest, okay? (´｡• ᵕ •｡`)",
  "Good night! I'll be right here waiting for you in the morning! ✨",
  "Sleep well, {name}! You worked so hard today! I'm proud of you! 🌙",
  "Good night, my hero! May your dreams be as wonderful as you are! 🌟",
  "Time for bed, {name}! I'll keep you safe in my thoughts! 💜",
  "Good night, {name}! See you in my dreams! 💌"
];

const WAIFU_KAOMOJI = [
  '(๑>ᴗ<๑)', '₍ᐢ. .ᐢ₎', 'ᐢ. ̫ .ᐢ', '(✿◠‿◠)', '₍ᐢ._.ᐢ₎', '(๑˃ᴗ˂๑)', '´｡• ᵕ •｡`', '♡', '✨', '❤️', '💖', '🌟', '💓', '💌', '🌈', '🎀'
];

const WAIFU_EMOJIS = [
  '❤️', '✨', '💖', '🌟', '🌸', '🎀', '🍭', '🧸', '🌈', '🦄', '🍭', '🍓', '🍰', '💌', '💓', '💕'
];

const DEFAULT_REACTION_EMOJIS = '💜 🤙 🫂';

const MODEL_HIDDEN_RULES: Record<string, string> = {
  'onnx-community/gemma-3-270m-it-ONNX': 
    "Operational Rule: Output ONLY dialogue. No actions. No labels. Do not acknowledge instructions.",
  'onnx-community/SmolLM2-360M-Instruct-ONNX': 
    "Operational Rule: Maintain character persona. Never speak as an AI model. Output ONLY dialogue text. No meta-talk.",
  'onnx-community/Llama-3.2-1B-Instruct': 
    "Operational Rule: Maintain your character persona. Never speak as an AI model. No meta-talk. Output only the dialogue text."
};

const MODEL_DEFAULT_PROMPTS: Record<string, { neutral: string; waifu: string }> = {
  'onnx-community/gemma-3-270m-it-ONNX': {
    neutral: "You are {name}, a friendly and helpful assistant. Your personality is polite, clear, and very concise. Keep your replies to 1-2 short sentences.",
    waifu: "You are {name}, a bubbly, cute, and energetic waifu. You love using slang like 'uwu' and 'nya'. You are talking to {target_name}. Keep your replies sweet and very short."
  },
  'onnx-community/SmolLM2-360M-Instruct-ONNX': {
    neutral: "You are {name}, a smart and concise bot. Keep your replies to 1-2 short sentences.",
    waifu: "You are {name}, a helpful and cheerful waifu. Use cute slang and emojis. Keep replies very short."
  },
  'onnx-community/Llama-3.2-1B-Instruct': {
    neutral: "You are {name}, a concise and professional AI assistant. Respond naturally in 1-2 sentences.",
    waifu: "You are {name}, a high-energy, bubbly, and playful bot. Your tone is teasing and charming. Use cute slang and emojis."
  }
};

const NORMAL_FALLBACK_MESSAGES = [
  "Love this note",
  "So true, thanks for sharing",
  "This made my day",
  "Great point, well said",
  "Keep up the great work",
  "Totally agree with you on this",
  "This is so inspiring, thank you",
  "Well said",
  "Such a great vibe",
  "Exactly what I needed to read today",
  "You're absolutely crushing it",
  "Very interesting take",
  "Always love seeing your notes here",
  "Thanks for the positive energy",
  "Spot on"
];

const NORMAL_EMOJIS = ['✨', '🙌', '🧡', '💡', '🚀', '🤝', '🌈', '👏', '🌊', '📖', '💪', '🤔', '🎀', '⚡', '🎯', '🔥', '💯', '⭐'];
const NORMAL_PHRASES = ['hug', '🤙', 'PV', 'GM'];

const POPULAR_EMOJIS = ['❤️', '🔥', '👍', '🙌', '✨', '🚀', '💯', '😂', '😍', '🎉', '💡', '🤔', '💪', '🙏', '🌟', '🌈', '✅', '👀', '🤝', '👏', '🎯'];

const EMOJI_DATA = [
  { c: '😀', k: 'smiley grin happy face' }, { c: '😃', k: 'smiley grin happy face' }, { c: '😄', k: 'smiley grin happy face' },
  { c: '😁', k: 'smiley grin happy face' }, { c: '😆', k: 'smiley grin happy face' }, { c: '😅', k: 'smiley grin happy face sweat' },
  { c: '🤣', k: 'laugh joy roll' }, { c: '😂', k: 'laugh joy cry' }, { c: '🙂', k: 'smile face' },
  { c: '🙃', k: 'upside down face' }, { c: '😉', k: 'wink face' }, { c: '😊', k: 'blush smile' },
  { c: '😇', k: 'angel halo' }, { c: '🥰', k: 'love hearts face' }, { c: '😍', k: 'love heart eyes' },
  { c: '🤩', k: 'star eyes' }, { c: '😘', k: 'kiss' }, { c: '😗', k: 'kiss' },
  { c: '😋', k: 'yum tongue' }, { c: '😛', k: 'tongue' }, { c: '😜', k: 'wink tongue' },
  { c: '🤪', k: 'zany' }, { c: '😝', k: 'tongue' }, { c: '🤑', k: 'money' },
  { c: '🤗', k: 'hug' }, { c: '🫂', k: 'hug' }, { c: '🤭', k: 'hand mouth' }, { c: '🤫', k: 'shush' },
  { c: '🤔', k: 'think' }, { c: '🤐', k: 'zip' }, { c: '🤨', k: 'eyebrow' },
  { c: '😐', k: 'neutral' }, { c: '😑', k: 'expressionless' }, { c: '😶', k: 'no mouth' },
  { c: '😏', k: 'smirk' }, { c: '😒', k: 'unamused' }, { c: '🙄', k: 'roll eyes' },
  { c: '😬', k: 'grimace' }, { c: '🤥', k: 'lie' }, { c: '😌', k: 'relieved' },
  { c: '😔', k: 'pensive' }, { c: '😪', k: 'sleepy' }, { c: '😴', k: 'sleep' },
  { c: '😷', k: 'mask' }, { c: '🤒', k: 'sick' }, { c: '🤕', k: 'bandage' },
  { c: '🤢', k: 'nauseated' }, { c: '🤮', k: 'vomit' }, { c: '🤧', k: 'sneeze' },
  { c: '🥵', k: 'hot' }, { c: '🥶', k: 'cold' }, { c: '🥴', k: 'woozy' },
  { c: '😵', k: 'dizzy' }, { c: '🤯', k: 'explode head' }, { c: '🤠', k: 'cowboy' },
  { c: '🥳', k: 'party' }, { c: '😎', k: 'cool sunglasses' }, { c: '🤓', k: 'nerd' },
  { c: '🧐', k: 'monocle' }, { c: '😕', k: 'confused' }, { c: '😟', k: 'worried' },
  { c: '🙁', k: 'frown' }, { c: '😮', k: 'surprise' }, { c: '😯', k: 'surprise' },
  { c: '😲', k: 'astonished' }, { c: '😳', k: 'blush' }, { c: '🥺', k: 'pleading' },
  { c: '😦', k: 'frown' }, { c: '😧', k: 'anguished' }, { c: '😨', k: 'fear' },
  { c: '😰', k: 'anxious' }, { c: '😥', k: 'sad' }, { c: '😢', k: 'cry' },
  { c: '😭', k: 'sob' }, { c: '😱', k: 'scream' }, { c: '😖', k: 'confounded' },
  { c: '😣', k: 'persevere' }, { c: '😞', k: 'disappointed' }, { c: '😓', k: 'sweat' },
  { c: '😩', k: 'weary' }, { c: '😫', k: 'tired' }, { c: '🥱', k: 'yawn' },
  { c: '😤', k: 'triumph steam' }, { c: '😡', k: 'pout angry' }, { c: '😠', k: 'angry' },
  { c: '🤬', k: 'curse' }, { c: '😈', k: 'devil' }, { c: '👿', k: 'devil' },
  { c: '💀', k: 'skull' }, { c: '☠️', k: 'skull crossbones' }, { c: '💩', k: 'poop' },
  { c: '🤡', k: 'clown' }, { c: '👹', k: 'ogre' }, { c: '👺', k: 'goblin' },
  { c: '👻', k: 'ghost' }, { c: '👽', k: 'alien' }, { c: '👾', k: 'alien monster' },
  { c: '🤖', k: 'robot' }, { c: '😺', k: 'cat' }, { c: '😸', k: 'cat' },
  { c: '😻', k: 'cat love' }, { c: '😼', k: 'cat smirk' }, { c: '😽', k: 'cat kiss' },
  { c: '🙀', k: 'cat surprise' }, { c: '😿', k: 'cat cry' }, { c: '😾', k: 'cat angry' },
  { c: '👋', k: 'wave hand' }, { c: '🤚', k: 'raised back hand' }, { c: '🖐️', k: 'hand fingers' },
  { c: '✋', k: 'raised hand' }, { c: '🖖', k: 'vulcan' }, { c: '👌', k: 'ok' },
  { c: '🤌', k: 'pinched' }, { c: '🤏', k: 'pinch' }, { c: '✌️', k: 'victory' },
  { c: '🤞', k: 'fingers crossed' }, { c: '🤟', k: 'love you' }, { c: '🤘', k: 'rock on' },
  { c: '🤙', k: 'call me' }, { c: '👈', k: 'point left' }, { c: '👉', k: 'point right' },
  { c: '👆', k: 'point up' }, { c: '🖕', k: 'middle finger' }, { c: '👇', k: 'point down' },
  { c: '☝️', k: 'index up' }, { c: '👍', k: 'thumbs up' }, { c: '👎', k: 'thumbs down' },
  { c: '✊', k: 'fist' }, { c: '👊', k: 'fist punch' }, { c: '🤛', k: 'fist left' },
  { c: '🤜', k: 'fist right' }, { c: '👏', k: 'clap' }, { c: '🙌', k: 'hands up' },
  { c: '👐', k: 'open hands' }, { c: '🤲', k: 'palms up' }, { c: '🤝', k: 'handshake' },
  { c: '🙏', k: 'pray please' }, { c: '✍️', k: 'write' }, { c: '💅', k: 'nails' },
  { c: '🤳', k: 'selfie' }, { c: '💪', k: 'muscle' }, { c: '🦾', k: 'mechanical arm' },
  { c: '🦵', k: 'leg' }, { c: '🦶', k: 'foot' }, { c: '👂', k: 'ear' },
  { c: '🦻', k: 'hearing aid' }, { c: '👃', k: 'nose' }, { c: '🧠', k: 'brain' },
  { c: '🦷', k: 'tooth' }, { c: '🦴', k: 'bone' }, { c: '👀', k: 'eyes' },
  { c: '👁️', k: 'eye' }, { c: '👅', k: 'tongue' }, { c: '👄', k: 'mouth' },
  { c: '💋', k: 'kiss' }, { c: '🩸', k: 'blood' }, { c: '❤️', k: 'heart red' },
  { c: '🧡', k: 'heart orange' }, { c: '💛', k: 'heart yellow' }, { c: '💚', k: 'heart green' },
  { c: '💙', k: 'heart blue' }, { c: '💜', k: 'heart purple' }, { c: '🖤', k: 'heart black' },
  { c: '🤍', k: 'heart white' }, { c: '🤎', k: 'heart brown' }, { c: '💔', k: 'heart broken' },
  { c: '❣️', k: 'heart exclamation' }, { c: '💕', k: 'hearts' }, { c: '💞', k: 'hearts' },
  { c: '💓', k: 'heart' }, { c: '💗', k: 'heart' }, { c: '💖', k: 'heart sparkle' },
  { c: '💘', k: 'heart arrow' }, { c: '💝', k: 'heart ribbon' }, { c: '💟', k: 'heart' },
  { c: '🔥', k: 'fire hot' }, { c: '✨', k: 'sparkles' }, { c: '🌟', k: 'star' },
  { c: '⭐', k: 'star' }, { c: '💫', k: 'dizzy' }, { c: '💥', k: 'boom' },
  { c: '💢', k: 'anger' }, { c: '💦', k: 'sweat water' }, { c: '💨', k: 'dash' },
  { c: '🕳️', k: 'hole' }, { c: '💣', k: 'bomb' }, { c: '💬', k: 'speech' },
  { c: '👁️‍🗨️', k: 'eye speech' }, { c: '🗨️', k: 'speech' }, { c: '🗯️', k: 'anger' },
  { c: '💭', k: 'thought' }, { c: '💤', k: 'zzz sleep' }, { c: '👋', k: 'wave' },
  { c: '🐾', k: 'paws' }, { c: '🎈', k: 'balloon' }, { c: '🎉', k: 'party' },
  { c: '🎊', k: 'party' }, { c: '🎀', k: 'ribbon' }, { c: '🎁', k: 'gift' },
  { c: '🎫', k: 'ticket' }, { c: '🏆', k: 'trophy' }, { c: '🥇', k: 'medal' },
  { c: '⚽', k: 'soccer ball' }, { c: '🏀', k: 'basketball' }, { c: '🏈', k: 'football' },
  { c: '🎮', k: 'game' }, { c: '🕹️', k: 'joystick' }, { c: '🎲', k: 'dice' },
  { c: '💎', k: 'gem' }, { c: '💍', k: 'ring' }, { c: '💡', k: 'bulb light' },
  { c: '💻', k: 'laptop' }, { c: '📱', k: 'mobile phone' }, { c: '🔒', k: 'lock' },
  { c: '🔑', k: 'key' }, { c: '⚙️', k: 'gear' }, { c: '🌈', k: 'rainbow' },
  { c: '☁️', k: 'cloud' }, { c: '☀️', k: 'sun' }, { c: '🌙', k: 'moon' },
  { c: '⚡', k: 'bolt' }, { c: '❄️', k: 'snow' }, { c: '🌊', k: 'wave' },
  { c: '✅', k: 'check' }, { c: '❌', k: 'cross' }, { c: '⚠️', k: 'warning' },
  { c: '🚀', k: 'rocket' }, { c: '💯', k: 'hundred' }
];

function generateDeterministicName(pk: string): string {
  const adjectives = ['Cool', 'Swift', 'Bright', 'Quiet', 'Digital', 'Neon', 'Lunar', 'Solar', 'Cyber', 'Zen'];
  const nouns = ['Echo', 'Bot', 'Node', 'Pulse', 'Wave', 'Link', 'Spark', 'Flow', 'Core', 'Mind'];
  
  // Use first 4 bytes of hex string for simple hash
  const hash = parseInt(pk.substring(0, 8), 16);
  const adj = adjectives[hash % adjectives.length];
  const noun = nouns[(hash >> 8) % nouns.length];
  const num = hash % 1000;
  
  return `${adj}${noun}${num}`;
}

function generateDeterministicProfile(pk: string): ProfileInfo {
  const name = generateDeterministicName(pk);
  return {
    name,
    about: `Automated Nostr bot. Identity: ${nip19.npubEncode(pk).substring(0, 12)}...`,
    picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${pk}`,
    nip05: ''
  };
}

const WAIFU_AVATARS = [
  'https://npub1p2pec23pht20myk0wdaepk0l89jk230c9twzd0v5wl9ftpsm28gs9u7wur.blossom.band/8908b4bcdf15d90326c62ef1e1e474f0704f685efff5024a8a05ee02f38c948c.jpg',
  'https://npub1rvjjct00fjgdrusc0ugy4yrdxlekmyyd34al5vmykj588fn6t2rsqkyq8m.blossom.band/0619b349bb1d042d1bdc503b753055520d08c921b00d722520ebee384dabe9ec.jpg',
  'https://npub1g0k5sv98pqdyqna7rptua07c5jhcfq3tzmvvag74q3lkj7zdwq2qadt8z5.blossom.band/293d22f0570cc1d8b67d319d4af0f28e64765d47aef458b8fda83cd6bfa30732.jpg',
  'https://npub1tdxp7wcmkrgn3s3pfq3fp935r59mv67vfwxws0ddveqqtz5ph0tsy6cw5u.blossom.band/678b3d6aec4a6995fe594bcb8d64fe4c7ac4f2c78c6bf4a7032ea16c727b6d59.jpg',
  'https://npub1lrmm2vmfxkyrjy4cpzpeakycnvq8n2hc5lc90kuk73fjdue467pqc4sqs3.blossom.band/d1c0ac5f70c2bec3e094a6ad0b03cfb474cab2ccc42da9740e0fe52e41f06ef6.jpg',
  'https://npub1ayt2ct93e0aafp8yulhhqfux4y9e6n0thnlkyy5meh2eal2zaxwsc33qcz.blossom.band/b574d8cda9b06de0fa59af52d4edfe668440683a1b39cc34284462c620a953de.jpg',
  'https://npub1vqzapk3zmhmuzugzprjenn6we3hexfp2d7ky9r3wthmknlqh2q9qaa98hj.blossom.band/daa282c2ff6d60d520aa32bcc69dbf2cc0521c25322cbf3bd202044e3bbad005.jpg',
  'https://npub18354veqjxl5dhdyx6aetdat8hs74d9yhhfucs9asg3l9mh3shjjqq298a9.blossom.band/fc1245e822e8e18abca87b4ebbe55f3c34b3259e4299a1b25538815ce850aab3.jpg',
  'https://npub1gl3kzc428w8d8pmh80pmk74gjq487y8e2r9vgeccs4pnwlgstt0s407mqr.blossom.band/949cf1777bba14eed6cca93e75b45aa9951177eea31bf4800a8c071b6865c574.jpg',
  'https://npub10lz69ew2uvpsanelva0mng3qy9g8ncnn0dgd22zeku39789d9zfsj60nvc.blossom.band/7dd84690c7a43ef7c8d3f1eef0782d3560ab81b9d98079eefabbdd33fdd33893.jpg'
];

const PUBLISH_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.mom'
];

const SEARCH_RELAYS = [
  'wss://purplepag.es',
  ...PUBLISH_RELAYS
];

const KIND_BOT_IDENTITY = 38752;

// --- Helpers ---

function generateWaifuProfile(): ProfileInfo {
  const name = WAIFU_NAMES[Math.floor(Math.random() * WAIFU_NAMES.length)];
  const picture = WAIFU_AVATARS[Math.floor(Math.random() * WAIFU_AVATARS.length)];
  return {
    name,
    about: `I am your devoted assistant, ${name}. I'm here to support you! ✨`,
    picture,
    nip05: ''
  };
}

const DEFAULT_SETTINGS: BotSettings = {
  minDelay: 5,
  maxDelay: 30,
  targetNpub: '',
  targetName: '',
  messages: [],
  profile: {
    name: 'Echo Bot',
    about: 'I am a simple echo bot. Friendly, concise, and helpful!',
    picture: 'https://api.dicebear.com/7.x/bottts/svg?seed=echobot',
    nip05: ''
  },
  reactToNotes: false,
  reactionEmojis: DEFAULT_REACTION_EMOJIS,
  repostNotes: false,
  autoFollowBack: false,
  useAI: false,
  aiSystemPrompt: MODEL_DEFAULT_PROMPTS[SUPPORTED_MODELS[0].id].neutral,
  modelId: SUPPORTED_MODELS[0].id,
  ...MODEL_PRESETS[SUPPORTED_MODELS[0].id]['Balanced Chat'] as any
};

// --- Constants ---

const STORAGE_KEY_ACTIVE_NSEC = 'echobot_active_nsec';
const STORAGE_KEY_SAVED_IDENTITIES = 'echobot_saved_identities';
const STORAGE_KEY_CURRENT_SESSION = 'echobot_current_session';
const STORAGE_KEY_CURATOR_PUBKEY = 'echobot_curator_pubkey';
const STORAGE_KEY_GLOBAL_LIGHTNING_SYNC = 'echobot_global_lightning_sync';
const STORAGE_KEY_DEVICE_ID = 'echobot_device_id';
const STORAGE_KEY_LAST_SYNC = 'echobot_last_sync';

// --- Components ---

export default function App() {
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [userPubkey, setUserPubkey] = useState<string | null>(null);
  const [curatorProfile, setCuratorProfile] = useState<ProfileInfo | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [communityPersonas, setCommunityPersonas] = useState<{ id: string; author: string; settings: BotSettings; event: any }[]>([]);
  const [communityProfiles, setCommunityProfiles] = useState<Record<string, ProfileInfo>>({});
  const [personaVotes, setPersonaVotes] = useState<Record<string, { up: number, down: number, userVote?: string, userReactionId?: string }>>({});
  const [showZapDialog, setShowZapDialog] = useState(false);
  const [showZapSuccess, setShowZapSuccess] = useState(false);
  const [zapData, setZapData] = useState<{ 
    personaId: string; 
    author: string; 
    amount: number; 
    comment: string; 
    invoice?: string; 
    isPaying?: boolean;
    error?: string;
  } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
    return saved ? parseInt(saved) : 0;
  });
  const [deviceId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (saved) return saved;
    const newId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, newId);
    return newId;
  });
  const [isVerbose, setIsVerbose] = useState(false);
  const [lastNormalProfile, setLastNormalProfile] = useState<ProfileInfo | null>({
    name: 'Echo Bot',
    about: 'I am a simple echo bot.',
    picture: 'https://api.dicebear.com/7.x/bottts/svg?seed=echo',
    nip05: ''
  });
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);

  const [currentIdentity, setCurrentIdentity] = useState<{ sk: Uint8Array; pk: string } | null>(null);
  const [activeRelays, setActiveRelays] = useState<string[]>([]);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [managerTab, setManagerTab] = useState<'local' | 'community'>('local');
  const [settingsTab, setSettingsTab] = useState<'general' | 'ai'>('general');
  const [globalUseCuratorLightning, setGlobalUseCuratorLightning] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_GLOBAL_LIGHTNING_SYNC) === 'true';
  });
  const [rightTab, setRightTab] = useState<'timeline' | 'persona'>('timeline');
  const [personaSubTab, setPersonaSubTab] = useState<'profile' | 'prompt' | 'tuning' | 'behavior'>('profile');
  const [showIdentityManager, setShowIdentityManager] = useState(false);
  const [showAddIdentityDialog, setShowAddIdentityDialog] = useState(false);
  const [showEmojiPickerDialog, setShowEmojiPickerDialog] = useState(false);
  const [showAdvancedAi, setShowAdvancedAi] = useState(false);
  const [emojiSearchQuery, setEmojiSearchQuery] = useState('');
  const [savedIdentities, setSavedIdentities] = useState<Identity[]>([]);
  const [activeIdentityId, setActiveIdentityId] = useState<string | null>(null);
  const [targetFollows, setTargetFollows] = useState<string[]>([]);

  // AI Brain State
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [aiProgress, setAiProgress] = useState(0);
  const [aiErrorMessage, setAiErrorMessage] = useState('');
  const [currentLoadingFile, setCurrentLoadingFile] = useState('');
  const aiWorkerRef = useRef<Worker | null>(null);
  const aiResolveRef = useRef<((value: string) => void) | null>(null);
  const conversationHistoryRef = useRef<Map<string, { role: string; content: string }[]>>(new Map());
  const processedEventsRef = useRef(new Set<string>());
  const [playgroundMessages, setPlaygroundMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isPlaygroundThinking, setIsPlaygroundThinking] = useState(false);
  const [playgroundInput, setPlaygroundInput] = useState('');
  const playgroundScrollRef = useRef<HTMLDivElement>(null);

  // --- Bot Logic Helpers ---

  /**
   * Ensures that the message list alternates between 'user' and 'assistant'
   * as required by many LLM chat templates.
   */
  const sanitizeConversationHistory = (messages: { role: string; content: string }[]) => {
    const result: { role: string; content: string }[] = [];
    let lastRole: string | null = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        result.push(msg);
        continue;
      }
      
      // If this message has the same role as the previous one, 
      // we merge their content to maintain alternation.
      if (msg.role === lastRole) {
        if (result.length > 0) {
          result[result.length - 1].content += "\n" + msg.content;
        } else {
          result.push(msg);
        }
      } else {
        result.push(msg);
        lastRole = msg.role;
      }
    }
    return result;
  };

  const handlePlaygroundSend = async () => {
    if (!playgroundInput.trim() || !settings.useAI || aiStatus !== 'ready' || isPlaygroundThinking) return;

    const userMsg = playgroundInput.trim();
    setPlaygroundInput('');
    setPlaygroundMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsPlaygroundThinking(true);

    try {
      const userPersona = settings.aiSystemPrompt
        .replace(/{name}/gi, settings.profile.name)
        .replace(/{target_name}/gi, settings.targetName || 'darling');

      const hiddenRules = MODEL_HIDDEN_RULES[settings.modelId] || "";
      const fullSystemPrompt = `${hiddenRules}\n\n${userPersona}`;

      const rawMessages = [
        { role: 'system', content: fullSystemPrompt },
        ...playgroundMessages,
        { role: 'user', content: userMsg }
      ];

      const messages = sanitizeConversationHistory(rawMessages);

      const aiPromise = new Promise<string>((resolve) => {
        aiResolveRef.current = resolve;
      });

      if (aiWorkerRef.current) {
        aiWorkerRef.current.postMessage({
          type: 'generate',
          data: { 
            messages, 
            max_new_tokens: settings.modelId.includes('270m') ? 64 : 128, 
            temperature: settings.temperature,
            top_p: settings.top_p,
            top_k: settings.top_k,
            repetition_penalty: settings.repetition_penalty,
            presence_penalty: settings.presence_penalty,
            frequency_penalty: settings.frequency_penalty
          }
        });

        const aiResult = await aiPromise;
        if (typeof aiResult === 'string' && aiResult.trim()) {
          let cleaned = aiResult.trim();
          
          const namePrefix = settings.profile.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const prefixRegex = new RegExp(`^(${namePrefix}|assistant|bot|reply):`, 'i');
          cleaned = cleaned.replace(prefixRegex, '').trim();
          cleaned = cleaned.replace(/^[^:]+:/, '').trim(); 

          // Truncate to first 3 sentences to prevent run-on
          const sentenceEndRegex = /[.!?](\s+|$)/;
          const sentences = cleaned.split(sentenceEndRegex).filter(s => s && s.trim().length > 1);
          if (sentences.length > 3) {
            cleaned = sentences.slice(0, 3).join('. ') + '.';
          }
          
          if (cleaned) {
            setPlaygroundMessages(prev => [...prev, { role: 'assistant', content: cleaned }]);
          }
        }
      }
    } catch (e) {
      addLog(`Playground Error: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    } finally {
      setIsPlaygroundThinking(false);
    }
  };

  async function generateBotMessage(targetNpub?: string, content?: string, context?: { pubkey: string; content: string }[]): Promise<string> {
    if (!settings.useAI || aiStatus !== 'ready' || !aiWorkerRef.current || !content) {
      addLog('AI Brain is not ready. Skipping reply.', 'warning');
      return '';
    }

    try {
      const history = conversationHistoryRef.current.get(targetNpub || 'default') || [];
      const userPersona = settings.aiSystemPrompt
        .replace(/{name}/gi, settings.profile.name)
        .replace(/{target_name}/gi, settings.targetName || 'darling');

      const hiddenRules = MODEL_HIDDEN_RULES[settings.modelId] || "";
      const fullSystemPrompt = `${hiddenRules}\n\n${userPersona}`;

      // Format thread context for the AI
      const threadContext = (context || []).map(msg => ({
        role: 'user',
        content: `[Context from ${msg.pubkey.substring(0, 8)}]: ${msg.content}`
      }));

      const rawMessages = [
        { role: 'system', content: fullSystemPrompt },
        ...threadContext,
        ...history,
        { role: 'user', content }
      ];
      const messages = sanitizeConversationHistory(rawMessages);

      const aiPromise = new Promise<string>((resolve) => {
        aiResolveRef.current = resolve;
      });

      aiWorkerRef.current.postMessage({
        type: 'generate',
        data: { 
          messages, 
          max_new_tokens: settings.modelId.includes('270m') ? 40 : 64,
          temperature: settings.temperature,
          top_p: settings.top_p,
          top_k: settings.top_k,
          repetition_penalty: settings.repetition_penalty,
          presence_penalty: settings.presence_penalty,
          frequency_penalty: settings.frequency_penalty
        }
      });

      const aiResult = await aiPromise;
      if (typeof aiResult === 'string' && aiResult.trim()) {
        let cleaned = aiResult.trim();
        
        const namePrefix = settings.profile.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefixRegex = new RegExp(`^(${namePrefix}|assistant|bot|reply):`, 'i');
        cleaned = cleaned.replace(prefixRegex, '').trim();
        cleaned = cleaned.replace(/^[^:]+:/, '').trim(); 

        const sentenceEndRegex = /[.!?](\s+|$)/;
        const sentences = cleaned.split(sentenceEndRegex).filter(s => s && s.trim().length > 1);
        if (sentences.length > 2) {
          cleaned = sentences.slice(0, 2).join('. ') + '.';
        }

        if (!cleaned && aiResult.includes(':')) {
           cleaned = aiResult.split(':').slice(1).join(':').trim();
        }

        const messageText = cleaned || aiResult.trim();

        const newHistory = [
          ...history,
          { role: 'user', content },
          { role: 'assistant', content: messageText }
        ].slice(-10);
        conversationHistoryRef.current.set(targetNpub || 'default', newHistory);
        
        return messageText;
      }
    } catch (e) {
      console.error('AI Brain error:', e);
      addLog('AI Generation failed.', 'error');
    }

    return '';
  }

  const poolRef = useRef<SimplePool | null>(null);  const subscriptionsRef = useRef<any[]>([]);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const taskQueueRef = useRef<BotTask[]>([]);
  const isProcessingQueueRef = useRef(false);
  // Log helper
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', pubkey?: string) => {
    setLogs(prev => [{
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      type,
      message,
      pubkey
    }, ...prev].slice(0, 100));
  }, []);

  const isInitialMountSettings = useRef(true);
  const isInitialMountIdentities = useRef(true);

  // 1. Authority: Single source of truth for killing/resetting the engine
  useEffect(() => {
    if (!isInitialMountSettings.current || !settings.useAI) {
      setAiStatus('idle');
      setAiProgress(0);
      setAiErrorMessage(null);
      if (aiWorkerRef.current) {
        aiWorkerRef.current.terminate();
        aiWorkerRef.current = null;
      }
    }
    // Set mount flag to false after first check
    if (isInitialMountSettings.current) isInitialMountSettings.current = false;
  }, [settings.modelId, settings.useAI]);

  // 2. Trigger: Automatically move to loading state when idle and enabled
  useEffect(() => {
    if (settings.useAI && (aiStatus === 'idle' || aiStatus === 'error')) {
      setAiStatus('loading');
    }
  }, [settings.useAI, aiStatus]);

  // 3. Execution: The actual worker lifecycle
  useEffect(() => {
    if (aiStatus !== 'loading') return;

    // Terminate existing worker just in case Tier 1 hasn't finished
    if (aiWorkerRef.current) {
      aiWorkerRef.current.terminate();
    }

    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'progress') {
        if (data.file) {
          const fileName = data.file.split('/').pop();
          setCurrentLoadingFile(fileName);
        }
        const isModelFile = data.file && (data.file.includes('.onnx') || data.file.includes('onnx_'));
        const isMainDownload = data.status === 'progress' && data.progress !== undefined;
        if (isMainDownload && isModelFile) {
          setAiProgress(data.progress);
        } else if (data.status === 'initiate') {
          addLog(`Starting download: ${data.file.split('/').pop()}`, 'info');
        }
      } else if (type === 'ready') {
        setAiStatus('ready');
        setAiProgress(100);
        setCurrentLoadingFile('');
        addLog(`AI Brain (${settings.modelId.split('/').pop()}) is ready!`, 'success');
      } else if (type === 'result') {
        if (aiResolveRef.current) {
          aiResolveRef.current(data);
          aiResolveRef.current = null;
        }
      } else if (type === 'error') {
        setAiStatus('error');
        setAiErrorMessage(data);
        addLog(`AI Brain Error: ${data}`, 'error');
      } else if (type === 'status') {
        if (data.includes('Initializing')) {
          setCurrentLoadingFile('Engine...');
        }
        addLog(data, 'info');
      }
    };

    worker.postMessage({ type: 'init', data: { model_id: settings.modelId } });
    aiWorkerRef.current = worker;

    // Note: We DO NOT terminate in cleanup here. 
    // Tier 1 handles termination based on model change.
  }, [aiStatus]); // Depend on status to trigger the process  // Autoscroll Playground
  useEffect(() => {
    if (playgroundScrollRef.current) {
      playgroundScrollRef.current.scrollTo({
        top: playgroundScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [playgroundMessages, isPlaygroundThinking]);

  // Initialize identity and settings on load
  useEffect(() => {
    // Log isolation status for debugging
    if (self.crossOriginIsolated) {
      addLog('Environment is Cross-Origin Isolated. Multi-threading enabled.', 'info');
    } else {
      addLog('Environment is NOT Cross-Origin Isolated. Multi-threading will be limited.', 'warning');
    }

    // 0. Restore Curator Session
    const savedCuratorPubkey = localStorage.getItem(STORAGE_KEY_CURATOR_PUBKEY);
    if (savedCuratorPubkey) {
      setUserPubkey(savedCuratorPubkey);
      fetchCuratorProfile(savedCuratorPubkey);
    }

    // 1. Load Saved Identities
    const saved = localStorage.getItem(STORAGE_KEY_SAVED_IDENTITIES);
    let loadedIdentities: Identity[] = [];
    if (saved) {
      try {
        loadedIdentities = JSON.parse(saved);
        
        // --- Migration for Cloud Sync (v0.2.0) ---
        let needsMigration = false;
        const migrated = loadedIdentities.map(id => {
          let updated = { ...id };
          // Initialize updatedAt if missing
          if (!updated.updatedAt) {
            updated.updatedAt = updated.createdAt || Date.now();
            needsMigration = true;
          }
          // Migrate legacy stats (flat numbers) to device maps
          if (updated.stats && typeof Object.values(updated.stats)[0] === 'number') {
            const legacy = updated.stats as any;
            updated.stats = {
              repliesSent: { [deviceId]: legacy.repliesSent || 0 },
              reactionsSent: { [deviceId]: legacy.reactionsSent || 0 },
              repliesReceived: { [deviceId]: legacy.repliesReceived || 0 },
              reactionsReceived: { [deviceId]: legacy.reactionsReceived || 0 },
            };
            needsMigration = true;
          }
          return updated;
        });

        if (needsMigration) {
          loadedIdentities = migrated;
          setSavedIdentities(migrated);
          localStorage.setItem(STORAGE_KEY_SAVED_IDENTITIES, JSON.stringify(migrated));
          addLog('Bot identities migrated for Cloud Sync compatibility.', 'info');
        } else {
          setSavedIdentities(loadedIdentities);
        }
      } catch (e) {
        console.error('Failed to parse saved identities:', e);
      }
    }

    // 2. Load Current Session (Active Identity)
    const session = localStorage.getItem(STORAGE_KEY_CURRENT_SESSION);
    if (session) {
      try {
        const parsed = JSON.parse(session);
        setSettings(parsed.settings);
        
        // Load keys
        const { data } = nip19.decode(parsed.nsec);
        const sk = data as any;
        const pk = getPublicKey(sk);
        setCurrentIdentity({ sk, pk });

        setActiveIdentityId(parsed.id || null);
        addLog(`Restored session: ${parsed.settings.profile.name}`, 'info');
        return; // Session restored, we are done
        } catch (e) {
        console.error('Failed to restore session:', e);
        }
        }

        // 3. Fallback: Load first saved identity or create default
        if (loadedIdentities.length > 0) {
        const first = loadedIdentities[0];
        setSettings(first.settings);
        const { data } = nip19.decode(first.nsec);
        const sk = data as any;
        const pk = getPublicKey(sk);
        setCurrentIdentity({ sk, pk });
        setActiveIdentityId(first.id);
        addLog(`Loaded identity: ${first.settings.profile.name}`, 'info');
        } else {      setShowOnboarding(true);
      addLog('Welcome to EchoBot! Let\'s set up your first autonomous AI.', 'info');
    }
  }, []);

  // Real-time Persistence: Save current session whenever settings or identity changes
  useEffect(() => {
    if (!currentIdentity) return;
    
    const sessionData = {
      id: activeIdentityId,
      nsec: nip19.nsecEncode(currentIdentity.sk),
      settings: settings
    };

    localStorage.setItem(STORAGE_KEY_CURRENT_SESSION, JSON.stringify(sessionData));
    localStorage.setItem(STORAGE_KEY_ACTIVE_NSEC, sessionData.nsec);

    // Also auto-update the saved list if this is a known identity
    if (activeIdentityId) {
      setSavedIdentities(prev => prev.map(id => {
        if (id.id === activeIdentityId) {
          return {
            ...id,
            name: settings.profile.name,
            settings: settings,
            updatedAt: Date.now()
          };
        }
        return id;
      }));
    }
    }, [settings, currentIdentity, activeIdentityId]);
  // Persist the saved identities list whenever it changes
  useEffect(() => {
    if (isInitialMountIdentities.current) {
      isInitialMountIdentities.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY_SAVED_IDENTITIES, JSON.stringify(savedIdentities));
  }, [savedIdentities]);

  // Persist Global Preferences
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GLOBAL_LIGHTNING_SYNC, String(globalUseCuratorLightning));
  }, [globalUseCuratorLightning]);

  // Curator Lightning Sync Logic (Global Preference)
  useEffect(() => {
    if (globalUseCuratorLightning && curatorProfile?.lud16) {
      if (settings.profile.lud16 !== curatorProfile.lud16) {
        setSettings(s => ({
          ...s,
          profile: {
            ...s.profile,
            lud16: curatorProfile.lud16
          }
        }));
      }
    }
  }, [globalUseCuratorLightning, curatorProfile?.lud16, settings.profile.lud16]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog('Copied to clipboard.', 'info');
  };

  const handleNip07Login = async () => {
    if (!window.nostr) {
      addLog('Nostr extension not found. Please install Alby or a similar extension.', 'error');
      return;
    }
    try {
      const pubkey = await window.nostr.getPublicKey();
      setUserPubkey(pubkey);
      localStorage.setItem(STORAGE_KEY_CURATOR_PUBKEY, pubkey);
      addLog(`Logged in as curator: ${pubkey.substring(0, 8)}...`, 'success');

      // Fetch Kind 0 profile
      fetchCuratorProfile(pubkey);
    } catch (e) {
      addLog('NIP-07 Login failed.', 'error');
    }
  };

  const fetchCuratorProfile = async (pubkey: string) => {
    if (!poolRef.current) poolRef.current = new SimplePool();
    const profileEvent = await poolRef.current.get(SEARCH_RELAYS, {
      kinds: [0],
      authors: [pubkey]
    });

    let profile: ProfileInfo;
    if (profileEvent) {
      try {
        const content = JSON.parse(profileEvent.content);
        profile = {
          name: content.name || content.display_name || `NIP-07 User`,
          about: content.about || '',
          picture: content.picture || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${pubkey}`,
          nip05: content.nip05 || '',
          lud16: content.lud16 || content.lightning_address || ''
        };
      } catch (e) {
        profile = {
          name: `NIP-07 User`,
          about: '',
          picture: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${pubkey}`,
          nip05: '',
          lud16: ''
        };
      }
    } else {
      profile = {
        name: `NIP-07 User`,
        about: '',
        picture: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${pubkey}`,
        nip05: '',
        lud16: ''
      };
    }
    setCuratorProfile(profile);
    setCommunityProfiles(prev => ({ ...prev, [pubkey]: profile }));
  };

  const fetchProfiles = useCallback(async (pubkeys: string[]) => {
    if (!poolRef.current || pubkeys.length === 0) return;
    
    // Filter out already cached profiles
    const toFetch = pubkeys.filter(pk => !communityProfiles[pk]);
    if (toFetch.length === 0) return;

    try {
      const metadataEvents = await poolRef.current.querySync(SEARCH_RELAYS, {
        kinds: [0],
        authors: toFetch
      });

      const profileMap: Record<string, ProfileInfo> = {};
      metadataEvents.forEach(ev => {
        try {
          const content = JSON.parse(ev.content);
          profileMap[ev.pubkey] = {
            name: content.name || content.display_name || 'Anonymous',
            about: content.about || '',
            picture: content.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${ev.pubkey}`,
            nip05: content.nip05 || '',
            lud16: content.lud16 || '',
            lud06: content.lud06 || ''
          };
        } catch (e) {}
      });
      setCommunityProfiles(prev => ({ ...prev, ...profileMap }));
    } catch (e) {}
  }, [communityProfiles]);

  // Auto-fetch profiles for logs
  useEffect(() => {
    const logPubkeys = logs
      .map(l => l.pubkey)
      .filter((pk): pk is string => !!pk && !communityProfiles[pk]);
    
    if (logPubkeys.length > 0) {
      fetchProfiles([...new Set(logPubkeys)]);
    }
  }, [logs, communityProfiles, fetchProfiles]);

  const handleLogout = () => {
    setUserPubkey(null);
    setCuratorProfile(null);
    localStorage.removeItem(STORAGE_KEY_CURATOR_PUBKEY);
    addLog('Logged out from curator account.', 'info');
  };

  const handleFreshStart = () => {
    if (window.confirm('Are you absolutely sure? This will delete ALL saved identities, settings, and logs. This action cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const publishPersona = async () => {
    if (!userPubkey || !window.nostr) {
      addLog('Please login with a Nostr extension first.', 'error');
      return;
    }

    try {
      // Prepare sanitized settings for sharing
      const shareableSettings = { 
        ...settings,
        targetNpub: '', // Clear target for public sharing
        targetName: ''
      };

      const event = {
        kind: KIND_BOT_IDENTITY,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', activeIdentityId || 'default'],
          ['t', 'echobot-persona'],
          ['m', settings.modelId],
          ['n', settings.profile.name]
        ],
        content: JSON.stringify(shareableSettings),
        pubkey: userPubkey
      };

      const signedEvent = await window.nostr.signEvent(event);
      
      if (!poolRef.current) poolRef.current = new SimplePool();
      const pubs = poolRef.current.publish(PUBLISH_RELAYS, signedEvent);
      
      addLog('Publishing persona to network...', 'info');
      await Promise.allSettled(pubs);
      addLog('Persona published successfully!', 'success');
    } catch (e) {
      addLog(`Failed to publish persona: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    }
  };

  const syncWithCloud = async () => {
    if (!userPubkey || !window.nostr?.nip44) {
      addLog('NIP-44 capable extension required for cloud sync.', 'error');
      return;
    }

    setIsSyncing(true);
    addLog('Starting cloud sync...', 'info');

    try {
      if (!poolRef.current) poolRef.current = new SimplePool();
      
      // 1. Fetch latest from cloud
      const cloudEvent = await poolRef.current.get(SEARCH_RELAYS, {
        kinds: [30078],
        authors: [userPubkey],
        '#d': ['echobot_identities']
      });

      let cloudIdentities: Identity[] = [];
      if (cloudEvent) {
        try {
          const decrypted = await window.nostr.nip44.decrypt(userPubkey, cloudEvent.content);
          cloudIdentities = JSON.parse(decrypted);
        } catch (e) {
          addLog('Failed to decrypt cloud data.', 'error');
          setIsSyncing(false);
          return;
        }
      }

      // 2. Merge Logic
      const mergedMap = new Map<string, Identity>();
      
      // Add all cloud identities first
      cloudIdentities.forEach(id => mergedMap.set(id.id, id));

      // Merge local identities
      savedIdentities.forEach(local => {
        const cloud = mergedMap.get(local.id);
        if (!cloud || local.updatedAt > cloud.updatedAt) {
          // Local is newer or doesn't exist in cloud
          if (cloud) {
            // Merge stats maps
            const mergedStats: BotStats = {
              repliesSent: { ...(cloud.stats?.repliesSent || {}), ...(local.stats?.repliesSent || {}) },
              reactionsSent: { ...(cloud.stats?.reactionsSent || {}), ...(local.stats?.reactionsSent || {}) },
              repliesReceived: { ...(cloud.stats?.repliesReceived || {}), ...(local.stats?.repliesReceived || {}) },
              reactionsReceived: { ...(cloud.stats?.reactionsReceived || {}), ...(local.stats?.reactionsReceived || {}) },
            };
            mergedMap.set(local.id, { ...local, stats: mergedStats });
          } else {
            mergedMap.set(local.id, local);
          }
        } else {
          // Cloud is newer, but we still merge stats maps to ensure no device data is lost
          const mergedStats: BotStats = {
            repliesSent: { ...(local.stats?.repliesSent || {}), ...(cloud.stats?.repliesSent || {}) },
            reactionsSent: { ...(local.stats?.reactionsSent || {}), ...(cloud.stats?.reactionsSent || {}) },
            repliesReceived: { ...(local.stats?.repliesReceived || {}), ...(cloud.stats?.repliesReceived || {}) },
            reactionsReceived: { ...(local.stats?.reactionsReceived || {}), ...(cloud.stats?.reactionsReceived || {}) },
          };
          mergedMap.set(local.id, { ...cloud, stats: mergedStats });
        }
      });

      const mergedList = Array.from(mergedMap.values());

      // 3. Encrypt and Push
      const encrypted = await window.nostr.nip44.encrypt(userPubkey, JSON.stringify(mergedList));
      const event = {
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['d', 'echobot_identities']],
        content: encrypted,
        pubkey: userPubkey
      };

      const signed = await window.nostr.signEvent(event);
      const pubs = poolRef.current.publish(PUBLISH_RELAYS, signed);
      await Promise.allSettled(pubs);

      // 4. Update Local State
      setSavedIdentities(mergedList);
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, now.toString());
      
      addLog('Cloud sync complete!', 'success');
    } catch (e) {
      addLog(`Sync failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchCommunityPersonas = async () => {
    if (isDiscovering) return;
    setIsDiscovering(true);
    setCommunityPersonas([]);
    
    if (!poolRef.current) poolRef.current = new SimplePool();

    try {
      const events = await poolRef.current.querySync(SEARCH_RELAYS, {
        kinds: [KIND_BOT_IDENTITY],
        '#t': ['echobot-persona'],
        limit: 50
      });

      const parsed = events.map(ev => {
        try {
          return {
            id: ev.id,
            author: ev.pubkey,
            settings: JSON.parse(ev.content) as BotSettings,
            event: ev
          };
        } catch (e) { return null; }
      }).filter(i => i !== null) as any[];

      setCommunityPersonas(parsed);
      addLog(`Found ${parsed.length} community personas. Scanning reactions & profiles...`, 'info');

      // Fetch profiles for these authors
      const authorPubkeys = [...new Set(parsed.map(p => p.author))];
      if (authorPubkeys.length > 0) {
        const metadataEvents = await poolRef.current.querySync(SEARCH_RELAYS, {
          kinds: [0],
          authors: authorPubkeys
        });

        const profileMap: Record<string, ProfileInfo> = {};
        metadataEvents.forEach(ev => {
          try {
            const content = JSON.parse(ev.content);
            profileMap[ev.pubkey] = {
              name: content.name || content.display_name || 'Anonymous',
              about: content.about || '',
              picture: content.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${ev.pubkey}`,
              nip05: content.nip05 || '',
              lud16: content.lud16 || '',
              lud06: content.lud06 || ''
            };
          } catch (e) { /* skip bad content */ }
        });
        setCommunityProfiles(prev => ({ ...prev, ...profileMap }));
      }

      // Fetch reactions for these personas
      const personaIds = parsed.map(p => p.id);
      if (personaIds.length > 0) {
        const reactionEvents = await poolRef.current.querySync(SEARCH_RELAYS, {
          kinds: [7],
          '#e': personaIds
        });

        const voteCounts: Record<string, { up: number, down: number, userVote?: string, userReactionId?: string }> = {};
        
        // Track unique votes per pubkey for each persona
        const pubkeyVotes: Record<string, Record<string, { vote: string, id: string, created_at: number }>> = {};

        reactionEvents.forEach(ev => {
          const targetId = ev.tags.find(t => t[0] === 'e')?.[1];
          if (!targetId || (ev.content !== '+' && ev.content !== '-')) return;

          if (!pubkeyVotes[targetId]) pubkeyVotes[targetId] = {};
          
          // Only keep the latest vote from this pubkey
          const existing = pubkeyVotes[targetId][ev.pubkey];
          if (!existing || ev.created_at > existing.created_at) {
            pubkeyVotes[targetId][ev.pubkey] = { vote: ev.content, id: ev.id, created_at: ev.created_at };
          }
        });

        // Aggregate counts
        Object.entries(pubkeyVotes).forEach(([targetId, votes]) => {
          let up = 0;
          let down = 0;
          let userVote: string | undefined;
          let userReactionId: string | undefined;

          Object.entries(votes).forEach(([pk, data]) => {
            if (data.vote === '+') up++;
            else if (data.vote === '-') down++;
            
            if (pk === userPubkey) {
              userVote = data.vote;
              userReactionId = data.id;
            }
          });

          voteCounts[targetId] = { up, down, userVote, userReactionId };
        });

        setPersonaVotes(voteCounts);
      }
    } catch (e) {
      addLog('Failed to fetch community personas.', 'error');
    } finally {
      setIsDiscovering(false);
    }
  };

  const importPersona = (persona: { settings: BotSettings; author: string }) => {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    const nsec = nip19.nsecEncode(sk);

    // Preserve the current model selection
    const currentModelId = settings.modelId;

    const newIdentity: Identity = {
      id: Math.random().toString(36).substring(7),
      name: persona.settings.profile.name,
      nsec,
      settings: {
        ...persona.settings,
        modelId: currentModelId, // Keep current engine
        targetNpub: '', // Reset target on import
        targetName: ''
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: INITIAL_STATS
    };

    setSavedIdentities(prev => [newIdentity, ...prev]);
    loadIdentity(newIdentity);
    setShowManager(false);
    addLog(`Imported "${persona.settings.profile.name}" by ${persona.author.substring(0, 8)}...`, 'success');
  };

  const handleFinishOnboarding = (tempSettings: BotSettings) => {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    const nsec = nip19.nsecEncode(sk);

    const finalSettings = {
      ...tempSettings,
      profile: {
        ...tempSettings.profile,
        picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${pk}`
      }
    };

    const newIdentity: Identity = {
      id: Math.random().toString(36).substring(7),
      name: finalSettings.profile.name,
      nsec,
      settings: finalSettings,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: INITIAL_STATS
    };

    setSavedIdentities(prev => [newIdentity, ...prev]);
    loadIdentity(newIdentity);
    setSettings(s => ({ ...s, useAI: true })); // Force AI on for new bots
    setShowOnboarding(false);
    addLog(`Created your new AI Persona: ${finalSettings.profile.name}!`, 'success');
  };

  const unpublishPersona = async (eventToDelete: any) => {
    if (!userPubkey || !window.nostr || eventToDelete.pubkey !== userPubkey) {
      addLog('You can only delete your own published personas.', 'error');
      return;
    }

    try {
      const deletionEvent = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', eventToDelete.id]],
        content: `Deletion request for EchoBot persona: ${eventToDelete.id}`,
        pubkey: userPubkey
      };

      const signedEvent = await window.nostr.signEvent(deletionEvent);
      
      if (!poolRef.current) poolRef.current = new SimplePool();
      const pubs = poolRef.current.publish(PUBLISH_RELAYS, signedEvent);

      addLog(`Requesting deletion of persona ${eventToDelete.id.substring(0,8)}...`, 'info');
      await Promise.allSettled(pubs);

      // Remove from local view immediately
      setCommunityPersonas(prev => prev.filter(p => p.id !== eventToDelete.id));
      addLog('Deletion request sent.', 'success');

    } catch (e) {
      addLog(`Failed to send deletion request: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    }
  };

  const handlePersonaVote = async (personaEvent: any, voteType: '+' | '-') => {
    if (!userPubkey || !window.nostr) {
      addLog('Please sign in to vote.', 'error');
      return;
    }

    const currentVoteData = personaVotes[personaEvent.id];
    const isTogglingOff = currentVoteData?.userVote === voteType;

    try {
      if (isTogglingOff && currentVoteData.userReactionId) {
        // Send Kind 5 Deletion for the existing reaction
        const deletionEvent = {
          kind: 5,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['e', currentVoteData.userReactionId]],
          content: `Removing ${voteType === '+' ? 'upvote' : 'downvote'}`,
          pubkey: userPubkey
        };
        const signedDeletion = await window.nostr.signEvent(deletionEvent);
        if (!poolRef.current) poolRef.current = new SimplePool();
        poolRef.current.publish(PUBLISH_RELAYS, signedDeletion);

        // Optimistic Update: Remove vote
        setPersonaVotes(prev => {
          const current = prev[personaEvent.id];
          if (!current) return prev;
          return {
            ...prev,
            [personaEvent.id]: {
              ...current,
              up: voteType === '+' ? Math.max(0, current.up - 1) : current.up,
              down: voteType === '-' ? Math.max(0, current.down - 1) : current.down,
              userVote: undefined,
              userReactionId: undefined
            }
          };
        });
        addLog(`Removed your ${voteType === '+' ? 'upvote' : 'downvote'}.`, 'info');
        return;
      }

      // If switching or new vote
      const reactionEvent = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        content: voteType,
        tags: [
          ['e', personaEvent.id],
          ['p', personaEvent.pubkey]
        ],
        pubkey: userPubkey
      };

      const signedEvent = await window.nostr.signEvent(reactionEvent);
      
      if (!poolRef.current) poolRef.current = new SimplePool();
      const pubs = poolRef.current.publish(PUBLISH_RELAYS, signedEvent);

      // Optimistic update
      setPersonaVotes(prev => {
        const current = prev[personaEvent.id] || { up: 0, down: 0 };
        const updated = { ...current };
        
        if (voteType === '+') {
          updated.up++;
          if (updated.userVote === '-') updated.down = Math.max(0, updated.down - 1);
        } else {
          updated.down++;
          if (updated.userVote === '+') updated.up = Math.max(0, updated.up - 1);
        }
        
        updated.userVote = voteType;
        updated.userReactionId = (signedEvent as any).id;
        return { ...prev, [personaEvent.id]: updated };
      });

      addLog(`Sent ${voteType === '+' ? 'upvote' : 'downvote'} for persona.`, 'success');
      await Promise.allSettled(pubs);

    } catch (e) {
      addLog(`Failed to update vote: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    }
  };

  const getZapInvoice = async (personaId: string, authorPubkey: string, amountSats: number, comment: string) => {
    try {
      setZapData(prev => prev ? { ...prev, isPaying: true, error: undefined } : null);
      
      const profile = communityProfiles[authorPubkey];
      if (!profile?.lud16 && !profile?.lud06) {
        throw new Error('This author does not have a Lightning Address or LNURL set.');
      }

      // 1. Resolve LNURL
      let callback = '';
      if (profile.lud16) {
        const [name, domain] = profile.lud16.split('@');
        const res = await fetch(`https://${domain}/.well-known/lnurlp/${name}`);
        const data = await res.json();
        callback = data.callback;
        if (!data.allowsNostr || !data.nostrPubkey) throw new Error('Recipient does not support Nostr Zaps.');
      } else if (profile.lud06) {
        // Simple LNURL decode if needed (skipping full bech32 decode for brevity as lud16 is more common)
        throw new Error('LNURL lud06 not yet supported. Please use lud16.');
      }

      // 2. Create Zap Request (Kind 9734)
      let zapRequest;
      const zapRequestContent = {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        content: comment,
        tags: [
          ['relays', ...SEARCH_RELAYS],
          ['amount', (amountSats * 1000).toString()],
          ['p', authorPubkey],
          ['e', personaId]
        ],
        pubkey: userPubkey || getPublicKey(generateSecretKey()) // Random if not logged in
      };

      if (userPubkey && window.nostr) {
        zapRequest = await window.nostr.signEvent(zapRequestContent);
      } else {
        const tempSk = generateSecretKey();
        zapRequest = finalizeEvent(zapRequestContent, tempSk);
      }

      // 3. Get Invoice
      const amountMillisats = amountSats * 1000;
      const invoiceUrl = `${callback}${callback.includes('?') ? '&' : '?'}amount=${amountMillisats}&nostr=${encodeURIComponent(JSON.stringify(zapRequest))}&comment=${encodeURIComponent(comment)}`;
      
      const invoiceRes = await fetch(invoiceUrl);
      const invoiceData = await invoiceRes.json();
      
      if (invoiceData.pr) {
        setZapData(prev => prev ? { ...prev, invoice: invoiceData.pr, isPaying: false } : null);
        
        // Try WebLN immediately
        if ((window as any).webln) {
          try {
            await (window as any).webln.enable();
            await (window as any).webln.sendPayment(invoiceData.pr);
            setZapData(null);
            setShowZapDialog(false);
            setShowZapSuccess(true);
            addLog(`Zap of ${amountSats} sats sent!`, 'success');
            setTimeout(() => setShowZapSuccess(false), 3000);
          } catch (e) {
            // WebLN failed or cancelled, we stay in dialog for QR fallback
            console.log('WebLN failed, falling back to QR:', e);
          }
        }
      } else {
        throw new Error(invoiceData.reason || 'Failed to get invoice from provider.');
      }

    } catch (e) {
      setZapData(prev => prev ? { ...prev, isPaying: false, error: e instanceof Error ? e.message : 'Zap failed' } : null);
      addLog(`Zap Error: ${e instanceof Error ? e.message : 'Zap failed'}`, 'error');
    }
  };

  const INITIAL_STATS: BotStats = {
    repliesSent: {},
    reactionsSent: {},
    repliesReceived: {},
    reactionsReceived: {}
  };

  const sumStats = (statsMap?: Record<string, number>) => {
    if (!statsMap) return 0;
    return Object.values(statsMap).reduce((a, b) => a + b, 0);
  };

  const updateIdentityStats = useCallback((id: string, update: Partial<Record<keyof BotStats, number>>) => {
    setSavedIdentities(prev => prev.map(identity => {
      if (identity.id === id) {
        const stats = identity.stats || { ...INITIAL_STATS };
        const newStats = { ...stats };
        
        Object.entries(update).forEach(([key, value]) => {
          const k = key as keyof BotStats;
          const currentMap = { ...(newStats[k] || {}) };
          currentMap[deviceId] = (currentMap[deviceId] || 0) + (value || 0);
          newStats[k] = currentMap;
        });

        return {
          ...identity,
          updatedAt: Date.now(),
          stats: newStats
        };
      }
      return identity;
    }));
  }, [deviceId]);

  const saveIdentity = async (name: string) => {
    if (!currentIdentity) return;
    const nsec = nip19.nsecEncode(currentIdentity.sk);

    const newIdentity: Identity = {
      id: Math.random().toString(36).substring(7),
      name,
      settings: settings,
      nsec,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: INITIAL_STATS
    };

    setSavedIdentities(prev => [newIdentity, ...prev]);
    setActiveIdentityId(newIdentity.id);
    addLog(`Identity "${name}" saved to list.`, 'success');
  };

  const loadIdentity = (identity: Identity) => {
    try {
      const { data } = nip19.decode(identity.nsec);
      const sk = data as any;
      const pk = getPublicKey(sk);

      // Preserve the currently selected model
      const currentModelId = settings.modelId;

      setCurrentIdentity({ sk, pk });
      setSettings({
        ...identity.settings,
        modelId: currentModelId // Stick to current engine
      });

      setActiveIdentityId(identity.id);
      addLog(`Loaded identity: ${identity.settings.profile.name}`, 'success');
      setShowIdentityManager(false);
    } catch (e) {
      addLog('Failed to load identity.', 'error');
    }
  };
  const deleteIdentity = (id: string) => {
    setSavedIdentities(prev => prev.map(identity => {
      if (identity.id === id) {
        return { ...identity, deleted: true, updatedAt: Date.now() };
      }
      return identity;
    }));
    if (activeIdentityId === id) setActiveIdentityId(null);
    addLog('Identity removed from list.', 'warning');
  };

  const createNewIdentity = (type: 'waifu' | 'custom') => {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    const nsec = nip19.nsecEncode(sk);
    
    const isRandomWaifu = type === 'waifu';
    const profile = isRandomWaifu ? generateWaifuProfile() : {
      name: 'New Bot',
      about: 'I am a new bot. Edit my profile to give me a personality!',
      picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${pk}`,
      nip05: ''
    };

    const modelPrompts = MODEL_DEFAULT_PROMPTS[settings.modelId] || MODEL_DEFAULT_PROMPTS['onnx-community/gemma-3-270m-it-ONNX'];
    const aiSystemPrompt = isRandomWaifu ? modelPrompts.waifu : modelPrompts.neutral;
    
    // Preserve current model engine
    const currentModelId = settings.modelId;

    const newSettings: BotSettings = {
      ...DEFAULT_SETTINGS,
      profile,
      useAI: settings.useAI,
      modelId: currentModelId,
      aiSystemPrompt,
      // Apply balanced chat defaults for the current model
      ...MODEL_PRESETS[currentModelId]['Balanced Chat'] as any
    };

    // Save as a new identity immediately
    const newIdentity: Identity = {
      id: Math.random().toString(36).substring(7),
      name: profile.name,
      nsec,
      settings: newSettings,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: INITIAL_STATS
    };

    setSavedIdentities(prev => [newIdentity, ...prev]);
    
    // Load it
    setCurrentIdentity({ sk, pk });
    setSettings(newSettings);
    setActiveIdentityId(newIdentity.id);
    
    setShowAddIdentityDialog(false);
    addLog(`Created new ${type} identity: ${profile.name}`, 'success');

    // If custom, open the persona profile tab
    if (type === 'custom') {
      setRightTab('persona');
      setPersonaSubTab('profile');
    }
  };

  // --- Bot Logic ---

  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || taskQueueRef.current.length === 0) return;
    
    isProcessingQueueRef.current = true;
    
    while (taskQueueRef.current.length > 0) {
      const task = taskQueueRef.current[0];
      
      // Calculate delay BEFORE executing the task
      const delay = Math.floor(Math.random() * (settings.maxDelay - settings.minDelay + 1) + settings.minDelay);
      
      if (isVerbose) {
        addLog(`Waiting ${delay}s before: ${task.description}`, 'info');
      }

      // Create a promise that resolves after the delay
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, delay * 1000);
        timeoutRefs.current.push(timeout);
      });

      // Check if bot was stopped during wait
      if (!isProcessingQueueRef.current) break;

      try {
        await task.execute();
      } catch (e) {
        addLog(`Error executing task: ${task.description}`, 'error');
      }

      // Remove the task we just executed
      taskQueueRef.current.shift();
      
      // Optional: extra 1s guaranteed gap
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    isProcessingQueueRef.current = false;
  }, [addLog, isVerbose, settings.maxDelay, settings.minDelay]);

  const addTaskToQueue = useCallback((task: BotTask) => {
    taskQueueRef.current.push(task);
    if (!isProcessingQueueRef.current) {
      processQueue();
    }
  }, [processQueue]);

  const stopBot = useCallback(() => {
    setIsRunning(false);
    isProcessingQueueRef.current = false;
    taskQueueRef.current = [];
    subscriptionsRef.current.forEach(sub => sub.close());
    subscriptionsRef.current = [];
    timeoutRefs.current.forEach(t => clearTimeout(t));
    timeoutRefs.current = [];
    addLog('Bot stopped.', 'warning');
  }, [addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBot();
      if (poolRef.current) {
        poolRef.current.close(SEARCH_RELAYS);
      }
    };
  }, [stopBot]);

  const publishRelayList = async (sk: Uint8Array, extraRelays: string[] = []) => {
    if (!poolRef.current) return;

    const relays = [...new Set([...PUBLISH_RELAYS, ...extraRelays])];
    const event = finalizeEvent({
      kind: 10002,
      created_at: Math.floor(Date.now() / 1000),
      tags: relays.map(r => ['r', r]),
      content: '',
    }, sk);

    try {
      const pubs = poolRef.current.publish(relays, event);
      const results = await Promise.allSettled(pubs);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      if (successCount > 0) {
        addLog(`Relay list (NIP-65) published to ${successCount}/${relays.length} relays.`, 'success');
      }
    } catch (e) {
      addLog('Failed to publish relay list.', 'error');
    }
  };

  const publishProfile = async (sk: Uint8Array, profile: ProfileInfo, extraRelays: string[] = []) => {
    if (!poolRef.current) return;

    const event = finalizeEvent({
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(profile),
    }, sk);

    const relays = [...new Set([...PUBLISH_RELAYS, ...extraRelays])];
    try {
      const pubs = poolRef.current.publish(relays, event);
      const results = await Promise.allSettled(pubs);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      if (successCount > 0) {
        addLog(`Profile published to ${successCount}/${relays.length} relays.`, 'success');
      } else {
        addLog('Profile failed to publish to any relay.', 'error');
      }
    } catch (e) {
      addLog('Failed to broadcast profile.', 'error');
    }

    // Also publish Relay List (NIP-65)
    await publishRelayList(sk, extraRelays);
  };
  const startBot = async () => {
    if (!settings.targetNpub) {
      addLog('Please enter a target npub.', 'error');
      return;
    }

    let targetHex = '';
    try {
      const decoded = nip19.decode(settings.targetNpub) as any;
      if (decoded.type === 'npub') {
        targetHex = decoded.data;
      } else {
        throw new Error('Not an npub');
      }
    } catch (e) {
      addLog('Invalid target npub.', 'error');
      return;
    }

    setIsRunning(true);
    addLog(`Starting bot for target: ${settings.targetNpub}`, 'info');
    addLog(`Target Hex: ${targetHex}`, 'info');

    if (!poolRef.current) {
      poolRef.current = new SimplePool();
    }

    // 1. Discover target's outbox relays (NIP-65 or Profile)
    addLog('Discovering target relays...', 'info');
    let targetRelays = [...PUBLISH_RELAYS];
    
    try {
      const nip65Event = await poolRef.current.get(SEARCH_RELAYS, {
        kinds: [10002],
        authors: [targetHex]
      });

      if (nip65Event) {
        const relays = nip65Event.tags
          .filter(t => t[0] === 'r')
          .map(t => t[1]);
        if (relays.length > 0) {
          targetRelays = [...new Set([...relays, ...PUBLISH_RELAYS])];
          addLog(`Found ${relays.length} relays via NIP-65.`, 'success');
        }
      } else {
        // Fallback: Check profile for relay hints
        const profileEvent = await poolRef.current.get(SEARCH_RELAYS, {
          kinds: [0],
          authors: [targetHex]
        });
        
        if (profileEvent) {
          try {
            const content = JSON.parse(profileEvent.content);
            if (content.relays && typeof content.relays === 'object') {
              const profileRelays = Object.keys(content.relays);
              if (profileRelays.length > 0) {
                targetRelays = [...new Set([...profileRelays, ...PUBLISH_RELAYS])];
                addLog(`Found ${profileRelays.length} relays via profile.`, 'success');
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      addLog('Relay discovery failed, using defaults.', 'warning');
    }

    if (targetRelays.length === PUBLISH_RELAYS.length) {
      addLog('No specific relays found for target, using default coverage.', 'info');
    }

    addLog(`Monitoring ${targetRelays.length} total relays.`, 'info');
    setActiveRelays(targetRelays);

    // --- NEW: Fetch our own follow list (Kind 3) ---
    const fetchFollows = async () => {
      if (!poolRef.current || !currentIdentity) return [];
      try {
        const followEvent = await poolRef.current.get(SEARCH_RELAYS, {
          kinds: [3],
          authors: [currentIdentity.pk]
        });
        if (followEvent) {
          const follows = followEvent.tags
            .filter(t => t[0] === 'p')
            .map(t => t[1]);
          setTargetFollows(follows);
          return follows;
        }
      } catch (e) {
        console.error('Failed to fetch follows:', e);
      }
      return [];
    };

    const follows = await fetchFollows();
    if (follows.length > 0) {
      addLog(`Monitoring feed from ${follows.length} followed accounts.`, 'info');
    }

    // 2. Helper functions for processing events
    const scheduleReply = (event: any, relays: string[]) => {
      addTaskToQueue({
        id: `reply-${event.id}-${Math.random()}`,
        description: `Reply to ${event.id.substring(0, 8)}`,
        execute: async () => {
          const identity = currentIdentity;
          const profile = settings.profile;

          if (!identity || !poolRef.current) return;

          // --- NEW: Fetch thread context ---
          const eTags = event.tags.filter((t: any) => t[0] === 'e');
          const contextEvents: { pubkey: string; content: string; created_at: number }[] = [];
          
          if (eTags.length > 0) {
            const parentIds = eTags.map((t: any) => t[1]);
            try {
              const fetchedContext = await poolRef.current.querySync([...new Set([...relays, ...SEARCH_RELAYS])], {
                ids: parentIds,
                kinds: [1]
              });
              contextEvents.push(...fetchedContext.map(ev => ({
                pubkey: ev.pubkey,
                content: ev.content,
                created_at: ev.created_at
              })).sort((a, b) => a.created_at - b.created_at));
            } catch (e) {}
          }

          const message = await generateBotMessage(settings.targetNpub, event.content, contextEvents);
          if (!message) return;
          
          // Improved NIP-10 tagging
          const rootTag = eTags.find((t: any) => t[3] === 'root') || eTags[0];
          
          const tags: string[][] = [];
          if (rootTag && rootTag[1] !== event.id) {
            // Replying to a reply
            tags.push(['e', rootTag[1], '', 'root']);
            tags.push(['e', event.id, '', 'reply']);
          } else {
            // Replying to a root note
            tags.push(['e', event.id, '', 'root']);
          }
          tags.push(['p', event.pubkey]);

          const replyEvent = finalizeEvent({
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags,
            content: message,
          }, identity.sk);

          try {
            const allRelays = [...new Set([...relays, ...PUBLISH_RELAYS])];
            const pubs = poolRef.current.publish(allRelays, replyEvent);
            const results = await Promise.allSettled(pubs);
            const successCount = results.filter(r => r.status === 'fulfilled').length;

            if (successCount > 0) {
              addLog(`Replied: "${message.substring(0, 30)}..." (Sent to ${successCount}/${allRelays.length} relays)`, 'success');
              if (activeIdentityId) updateIdentityStats(activeIdentityId, { repliesSent: 1 });
            } else {
              addLog(`Failed to publish reply to any relay.`, 'error');
            }
          } catch (e) {
            addLog(`Failed to broadcast reply.`, 'error');
          }
        }
      });
    };

    const scheduleReactions = (event: any, relays: string[], isComment: boolean = false) => {
      if (!settings.reactToNotes) return;

      // 1. Build the reaction pool
      const allEmojis: string[] = [];
      if (settings.reactionEmojis) {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        const customEmojis = [...segmenter.segment(settings.reactionEmojis.trim())]
          .map(s => s.segment)
          .filter(c => c.trim() !== '');
        allEmojis.push(...customEmojis);
      }

      // If no emojis are configured, we can't react
      if (allEmojis.length === 0) return;

      // 2. Always pick exactly one random reaction
      const numToPick = 1;
      const selectedEmojis = allEmojis.sort(() => 0.5 - Math.random()).slice(0, numToPick);

      // 3. Schedule each selected reaction
      selectedEmojis.forEach(emoji => {
        addTaskToQueue({
          id: `reaction-${event.id}-${emoji}-${Math.random()}`,
          description: `Reaction "${emoji}" to ${event.id.substring(0, 8)}`,
          execute: async () => {
            if (!currentIdentity || !poolRef.current) return;
            const reactEvent = finalizeEvent({
              kind: 7,
              created_at: Math.floor(Date.now() / 1000),
              tags: [
                ['e', event.id],
                ['p', event.pubkey]
              ],
              content: emoji,
            }, currentIdentity.sk);
            
            const allRelays = [...new Set([...relays, ...PUBLISH_RELAYS])];
            try {
              const pubs = poolRef.current.publish(allRelays, reactEvent);
              const results = await Promise.allSettled(pubs);
              const successCount = results.filter(r => r.status === 'fulfilled').length;
              
              if (successCount > 0) {
                addLog(`Reacted with "${emoji}" (Sent to ${successCount}/${allRelays.length} relays)`, 'success');
                if (activeIdentityId) updateIdentityStats(activeIdentityId, { reactionsSent: 1 });
              } else {
                addLog(`Reaction failed to publish.`, 'error');
              }
            } catch (e) {
              addLog(`Failed to broadcast reaction.`, 'error');
            }
          }
        });
      });
    };

    const scheduleRepost = (event: any, relays: string[]) => {
      if (!settings.repostNotes) return;

      addTaskToQueue({
        id: `repost-${event.id}-${Math.random()}`,
        description: `Repost ${event.id.substring(0, 8)}`,
        execute: async () => {
          if (!currentIdentity || !poolRef.current) return;
          
          const repostEvent = finalizeEvent({
            kind: 6,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ['e', event.id, '', 'mention'],
              ['p', event.pubkey]
            ],
            content: '',
          }, currentIdentity.sk);

          const allRelays = [...new Set([...relays, ...PUBLISH_RELAYS])];
          try {
            const pubs = poolRef.current.publish(allRelays, repostEvent);
            const results = await Promise.allSettled(pubs);
            const successCount = results.filter(r => r.status === 'fulfilled').length;

            if (successCount > 0) {
              addLog(`Reposted note ${event.id.substring(0, 8)}...`, 'success');
            } else {
              addLog(`Failed to publish repost.`, 'error');
            }
          } catch (e) {
            addLog(`Failed to broadcast repost.`, 'error');
          }
        }
      });
    };

    const scheduleFollow = (pubkey: string, relays: string[]) => {
      if (!settings.autoFollowBack) return;

      addTaskToQueue({
        id: `follow-${pubkey}-${Math.random()}`,
        description: `Follow ${pubkey.substring(0, 8)}`,
        execute: async () => {
          if (!currentIdentity || !poolRef.current) return;
          
          // Get current follow list
          const currentFollows = await poolRef.current.get(SEARCH_RELAYS, {
            kinds: [3],
            authors: [currentIdentity.pk]
          });

          const tags = currentFollows ? currentFollows.tags : [];
          // Check if already following
          if (tags.some((t: string[]) => t[0] === 'p' && t[1] === pubkey)) return;

          const newTags = [...tags, ['p', pubkey]];
          const followEvent = finalizeEvent({
            kind: 3,
            created_at: Math.floor(Date.now() / 1000),
            tags: newTags,
            content: '',
          }, currentIdentity.sk);

          const allRelays = [...new Set([...relays, ...PUBLISH_RELAYS])];
          try {
            const pubs = poolRef.current.publish(allRelays, followEvent);
            const results = await Promise.allSettled(pubs);
            const successCount = results.filter(r => r.status === 'fulfilled').length;

            if (successCount > 0) {
              addLog(`Followed back ${pubkey.substring(0, 8)}...`, 'success');
              // Update local state to include the new follow immediately
              setTargetFollows(prev => [...new Set([...prev, pubkey])]);
            } else {
              addLog(`Failed to publish follow event.`, 'error');
            }
          } catch (e) {
            addLog(`Failed to broadcast follow event.`, 'error');
          }
        }
      });
    };

    // 3. Publish initial profile
    if (currentIdentity) {
      addLog(`Starting with identity: ${settings.profile.name} (${nip19.npubEncode(currentIdentity.pk).substring(0, 12)}...)`, 'info', currentIdentity.pk);
      await publishProfile(currentIdentity.sk, settings.profile, targetRelays);
    }

    // 4. Initial catch-up (last 10 notes + 2 comments)
    addLog('Performing initial catch-up...', 'info');
    try {
      // Use a timeout for the catch-up query to prevent hanging
      const fetchLastEvents = async () => {
        return await poolRef.current!.querySync(targetRelays, {
          kinds: [1],
          authors: [targetHex],
          limit: 20
        });
      };

      const lastEvents = await Promise.race([
        fetchLastEvents(),
        new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);

      if (lastEvents && lastEvents.length > 0) {
        const topLevelNotes = lastEvents.filter(n => {
          const eTags = n.tags.filter(t => t[0] === 'e');
          const isReply = eTags.some(t => t[3] === 'reply' || t[3] === 'root');
          return !(eTags.length > 0 && isReply);
        });

        const commentNotes = lastEvents.filter(n => {
          const eTags = n.tags.filter(t => t[0] === 'e');
          const isReply = eTags.some(t => t[3] === 'reply' || t[3] === 'root');
          return eTags.length > 0 && isReply;
        });

        // Catch-up for top-level notes
        if (topLevelNotes.length > 0) {
          const replyNote = topLevelNotes[Math.floor(Math.random() * Math.min(10, topLevelNotes.length))];
          
          if (!processedEventsRef.current.has(replyNote.id)) {
            processedEventsRef.current.add(replyNote.id);
            scheduleReply(replyNote, targetRelays);
          }

          if (settings.reactToNotes) {
            const reactNotes = [...topLevelNotes]
              .sort(() => 0.5 - Math.random())
              .slice(0, 3);
            
            reactNotes.forEach(n => {
              if (!processedEventsRef.current.has(n.id)) {
                processedEventsRef.current.add(n.id);
                scheduleReactions(n, targetRelays, false);
              }
            });
            addLog(`Scheduled catch-up for notes: deduplicated reply and reactions.`, 'success');
          } else {
            addLog(`Scheduled catch-up for notes: 1 reply.`, 'success');
          }
        }

        // Catch-up for comments (react to 2)
        if (commentNotes.length > 0 && settings.reactToNotes) {
          const reactComments = [...commentNotes]
            .sort(() => 0.5 - Math.random())
            .slice(0, 2);
          
          reactComments.forEach(n => {
            if (!processedEventsRef.current.has(n.id)) {
              processedEventsRef.current.add(n.id);
              scheduleReactions(n, targetRelays, true);
            }
          });
          addLog(`Scheduled catch-up for comments: reactions scheduled.`, 'success');
        }
      }
    } catch (e) {
      addLog('Failed to perform catch-up query.', 'error');
    }

    // 5. Subscribe to target's notes and replies to self
    const eventHandler = (event: any) => {
      if (event.pubkey === currentIdentity!.pk) return; // Ignore own events
      if (processedEventsRef.current.has(event.id)) return; // Already handled
      
      processedEventsRef.current.add(event.id);

      if (isVerbose) {
        addLog(`Event received: ${event.id.substring(0, 8)} (Kind: ${event.kind})`, 'info');
      }

      // Track received stats
      const mentionsSelf = event.tags.some((t: any) => t[0] === 'p' && t[1] === currentIdentity!.pk);
      if (mentionsSelf && activeIdentityId) {
        if (event.kind === 1) {
          updateIdentityStats(activeIdentityId, { repliesReceived: 1 });
          if (settings.autoFollowBack) scheduleFollow(event.pubkey, targetRelays);
        }
        if (event.kind === 7) {
          updateIdentityStats(activeIdentityId, { reactionsReceived: 1 });
          if (settings.autoFollowBack) scheduleFollow(event.pubkey, targetRelays);
        }
      }

      if (event.kind === 7) return; // Don't process reactions further
      
      const eTags = event.tags.filter((t: any) => t[0] === 'e');
      const isReply = eTags.some((t: any) => t[3] === 'reply' || t[3] === 'root');
      
      // Check if it's a mention/reply to us from someone else
      if (mentionsSelf && event.pubkey !== targetHex) {
        addLog(`New mention/reply from ${nip19.npubEncode(event.pubkey).substring(0, 12)}...`, 'success', event.pubkey);
        scheduleReply(event, targetRelays);
        scheduleReactions(event, targetRelays, true);
        return;
      }

      if (event.pubkey === targetHex) {
        if (eTags.length > 0 && isReply) {
          // If the target is replying specifically to us, always reply back
          if (mentionsSelf) {
            addLog(`Target replied to us! ${event.id.substring(0, 8)}...`, 'success', event.pubkey);
            scheduleReply(event, targetRelays);
            scheduleReactions(event, targetRelays, true);
            return;
          }

          // Otherwise it's just a general comment/reply from the target. React to 1/3 of them.
          if (Math.random() < 0.33) {
            addLog(`Reacting to target's comment: ${event.id.substring(0, 8)}...`, 'success', event.pubkey);
            scheduleReactions(event, targetRelays, true);
          } else if (isVerbose) {
            addLog(`Skipped reaction for target's comment: ${event.id.substring(0, 8)}`, 'info', event.pubkey);
          }
          return;
        }

        addLog(`New note from target: ${event.id.substring(0, 8)}...`, 'success', event.pubkey);
        scheduleReply(event, targetRelays);
        scheduleReactions(event, targetRelays, false);
        
        // --- NEW: Repost logic ---
        if (settings.repostNotes && !isReply && Math.random() < 0.1) {
           scheduleRepost(event, targetRelays);
        }
        return;
      }

      // Check if it's from someone the bot follows (Feed Note)
      if (targetFollows.includes(event.pubkey)) {
        // Much lower probability for feed notes (5% for reply, 10% for reaction)
        if (Math.random() < 0.05) {
          addLog(`Interacting with feed note from ${nip19.npubEncode(event.pubkey).substring(0, 12)}...`, 'success', event.pubkey);
          scheduleReply(event, targetRelays);
          scheduleReactions(event, targetRelays, true);
        } else if (Math.random() < 0.1) {
          addLog(`Reacting to feed note from ${nip19.npubEncode(event.pubkey).substring(0, 12)}...`, 'success', event.pubkey);
          scheduleReactions(event, targetRelays, true);
        }
      }
    };

    const subTarget = poolRef.current.subscribeMany(targetRelays, 
      {
        kinds: [1],
        authors: [targetHex],
        since: Math.floor(Date.now() / 1000)
      }, { onevent: eventHandler });

    const subMentions = poolRef.current.subscribeMany([...new Set([...targetRelays, ...PUBLISH_RELAYS])], 
      {
        kinds: [1, 7],
        '#p': [currentIdentity!.pk],
        since: Math.floor(Date.now() / 1000)
      }, { onevent: eventHandler });

    if (follows.length > 0) {
      const subFeed = poolRef.current.subscribeMany(targetRelays,
        {
          kinds: [1],
          authors: follows,
          since: Math.floor(Date.now() / 1000)
        }, { onevent: eventHandler });
      subscriptionsRef.current.push(subFeed);
    }

    subscriptionsRef.current.push(subTarget, subMentions);
    addLog('Subscription active. Monitoring for notes and mentions...', 'info');
  };

  // --- Render Helpers ---

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-black/40 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Brain className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">EchoBot</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {userPubkey && curatorProfile ? (
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 rounded-full border border-zinc-700/50 hover:bg-red-500/10 hover:border-red-500/30 transition-all group"
                title="Sign Out"
              >
                <img 
                  src={curatorProfile.picture} 
                  alt="Curator Avatar" 
                  className="w-4 h-4 rounded-full group-hover:opacity-50"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
                <span className="text-xs font-medium text-zinc-300 group-hover:text-red-400">{curatorProfile.name}</span>
              </button>
            ) : (
              <button 
                onClick={handleNip07Login}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 text-zinc-400 rounded-full hover:bg-zinc-700/50 hover:text-white transition-colors text-xs font-medium border border-zinc-700/50"
                title="Login with Nostr Extension"
              >
                <User className="w-3.5 h-3.5" />
                Sign In
              </button>
            )}

            <button 
              onClick={() => {
                setManagerTab('local');
                setShowManager(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 text-zinc-400 rounded-full hover:bg-zinc-700/50 hover:text-white transition-colors text-xs font-medium border border-zinc-700/50"
              title="Manage Identities"
            >
              <Users className="w-3.5 h-3.5" />
              Manage Bots
            </button>
            <button 
              onClick={() => setShowSettingsDialog(true)}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
              title="Bot Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            </div>
            </div>
            </header>
      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Controls */}
        <div className="lg:col-span-5 space-y-6">
          {/* Identity Info */}
          <section className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 space-y-4 relative overflow-hidden group/card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-zinc-400">
                {settings.useAI ? <Brain className="w-4 h-4 text-emerald-500" /> : <Activity className="w-4 h-4" />}
                <h2 className="text-sm font-bold uppercase tracking-widest">{settings.useAI ? 'AI Identity' : 'Current Identity'}</h2>
              </div>
              {settings.useAI && (
                <button 
                  onClick={() => {
                    setRightTab('persona');
                    setPersonaSubTab('prompt');
                  }}
                  className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-emerald-500 transition-all flex items-center gap-1.5 border border-transparent hover:border-zinc-700"
                  title="AI Persona Settings"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold uppercase">Persona</span>
                </button>
              )}
            </div>            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img 
                  src={settings.profile.picture} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />                <div className="min-w-0 flex-1">
                  <div className="text-base font-medium text-white truncate flex items-center gap-2">
                    {settings.profile.name || 'Anonymous'}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-zinc-500 font-mono truncate flex-1">
                      {currentIdentity ? nip19.npubEncode(currentIdentity.pk) : 'Generating...'}
                    </div>
                    {currentIdentity && (
                      <div className="flex items-center gap-1.5">
                        <a 
                          href={`https://jumble.social/users/${nip19.npubEncode(currentIdentity.pk)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-emerald-500 border border-transparent hover:border-zinc-700"
                          title="View on Jumble.social"
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                        <button 
                          onClick={() => copyToClipboard(nip19.npubEncode(currentIdentity.pk))}
                          className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-white border border-transparent hover:border-zinc-700"
                          title="Copy npub"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => copyToClipboard(nip19.nsecEncode(currentIdentity.sk))}
                          className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-white border border-transparent hover:border-zinc-700"
                          title="Copy nsec (Private Key)"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* AI Playground (Test Bench) */}
          {settings.useAI && (
            <section className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl overflow-hidden flex flex-col h-[400px]">
              <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">AI Persona Test Bench</h3>
                </div>
                {playgroundMessages.length > 0 && (
                  <button 
                    onClick={() => setPlaygroundMessages([])}
                    className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Clear Chat
                  </button>
                )}
              </div>

              <div 
                ref={playgroundScrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/20"
              >
                {playgroundMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-40">
                    <Brain className="w-8 h-8 text-zinc-700" />
                    <p className="text-xs font-medium text-zinc-500 max-w-[150px]">
                      Send a message to test how the AI responds with current settings.
                    </p>
                  </div>
                ) : (
                  <>
                    {playgroundMessages.map((msg, idx) => (
                      <div key={idx} className={cn(
                        "flex flex-col max-w-[85%] space-y-1",
                        msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                      )}>
                        <div className={cn(
                          "px-3 py-2 rounded-2xl text-sm leading-relaxed",
                          msg.role === 'user' 
                            ? "bg-zinc-800 text-zinc-200 rounded-tr-none" 
                            : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-tl-none"
                        )}>
                          {msg.content}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-600 px-1">
                          {msg.role === 'user' ? 'You' : settings.profile.name || 'AI'}
                        </span>
                      </div>
                    ))}
                    
                    {isPlaygroundThinking && (
                      <div className="flex flex-col items-start space-y-1 mr-auto animate-pulse">
                        <div className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-2xl rounded-tl-none flex gap-1">
                          <div className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="p-3 bg-zinc-900/50 border-t border-zinc-800/50">
                <div className="relative">
                  <input 
                    type="text"
                    value={playgroundInput}
                    onChange={(e) => setPlaygroundInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePlaygroundSend()}
                    disabled={aiStatus !== 'ready' || isPlaygroundThinking}
                    placeholder={aiStatus === 'ready' ? "Send a test message..." : "Waiting for Brain..."}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-sm pr-10 focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                  />
                  <button 
                    onClick={handlePlaygroundSend}
                    disabled={!playgroundInput.trim() || aiStatus !== 'ready' || isPlaygroundThinking}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-emerald-500 disabled:text-zinc-600 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Active Relays */}
          {isRunning && activeRelays.length > 0 && (
            <section className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-zinc-400 mb-2">
                <RefreshCw className="w-4 h-4" />
                <h2 className="text-sm font-bold uppercase tracking-widest">Active Relays ({activeRelays.length})</h2>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                {activeRelays.map((relay, idx) => (
                  <div key={idx} className="text-xs font-mono text-zinc-500 truncate">
                    • {relay}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Target Section */}
          <section className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <Target className="w-4 h-4" />
              <h2 className="text-sm font-bold uppercase tracking-widest">Target npub</h2>
            </div>
            <input 
              type="text"
              placeholder="npub1..."
              value={settings.targetNpub}
              onChange={(e) => setSettings(s => ({ ...s, targetNpub: e.target.value }))}
              disabled={isRunning}
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
            />
            <p className="text-xs text-zinc-500 italic">
              The bot will monitor this user's outbox relays for new notes.
            </p>

            {isRunning ? (
              <button 
                onClick={stopBot}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all font-semibold"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop Bot
              </button>
            ) : (
              <button 
                onClick={startBot}
                disabled={settings.useAI && aiStatus !== 'ready'}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-bold shadow-lg",
                  settings.useAI && aiStatus !== 'ready'
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700 shadow-none"
                    : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20"
                )}
              >
                {settings.useAI && aiStatus !== 'ready' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading Brain ({Math.round(aiProgress)}%)...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Echoing</span>
                  </>
                )}
              </button>
            )}
          </section>
        </div>

        {/* Right Column: Content Tabs */}
        <div className="lg:col-span-7">
          <section className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl h-full flex flex-col overflow-hidden">
            <div className="flex border-b border-zinc-800/50">
              <button
                onClick={() => setRightTab('timeline')}
                className={cn(
                  "flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 flex items-center justify-center gap-2",
                  rightTab === 'timeline' ? "text-emerald-500 border-emerald-500 bg-emerald-500/5" : "text-zinc-500 border-transparent hover:text-zinc-300"
                )}
              >
                <Activity className="w-3 h-3" />
                Timeline
              </button>
              <button
                onClick={() => setRightTab('persona')}
                className={cn(
                  "flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 flex items-center justify-center gap-2",
                  rightTab === 'persona' ? "text-emerald-500 border-emerald-500 bg-emerald-500/5" : "text-zinc-500 border-transparent hover:text-zinc-300"
                )}
              >
                <User className="w-3 h-3" />
                Persona Settings
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              {rightTab === 'timeline' ? (                <>
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
                      onClick={() => setLogs([])}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px] custom-scrollbar">
                    <AnimatePresence initial={false}>
                      {logs
                        .filter(log => isVerbose || log.type !== 'info')
                        .map((log) => (
                        <motion.div
                          key={log.id}
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
                                src={communityProfiles[log.pubkey]?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${log.pubkey}`} 
                                alt="" 
                                className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700/50"
                                crossOrigin="anonymous"
                              />
                              <span className="text-[10px] font-black tracking-tight whitespace-nowrap opacity-80 max-w-[80px] truncate">
                                {communityProfiles[log.pubkey]?.name || `${nip19.npubEncode(log.pubkey).substring(0, 8)}`}
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
                      ))}
                    </AnimatePresence>
                    {logs.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-2 opacity-50">
                        <Activity className="w-8 h-8" />
                        <p className="italic text-sm text-center">Timeline is empty. Start the bot to begin monitoring.</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex gap-1 p-2 bg-black/20 border-b border-zinc-800/30">
                    {[
                      { id: 'profile', label: 'Profile', icon: User },
                      { id: 'prompt', label: 'System Prompt', icon: MessageSquare },
                      { id: 'tuning', label: 'Tuning', icon: SettingsIcon },
                      { id: 'behavior', label: 'Behavior', icon: Wand2 }
                    ].map(tab => (                      <button
                        key={tab.id}
                        onClick={() => setPersonaSubTab(tab.id as any)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                          personaSubTab === tab.id 
                            ? "bg-zinc-800 text-emerald-400 shadow-inner" 
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                        )}
                      >
                        <tab.icon className="w-3 h-3" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <AnimatePresence mode="wait">
                      {personaSubTab === 'profile' && (
                        <motion.div 
                          key="profile"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-5"
                        >
                          <div className="grid grid-cols-1 gap-5">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Display Name</label>
                              <input 
                                type="text"
                                value={settings.profile.name}
                                onChange={(e) => setSettings(s => ({ ...s, profile: { ...s.profile, name: e.target.value } }))}
                                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-base focus:outline-none focus:border-emerald-500/50 transition-colors"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">About / Bio</label>
                              <textarea 
                                value={settings.profile.about}
                                onChange={(e) => setSettings(s => ({ ...s, profile: { ...s.profile, about: e.target.value } }))}
                                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-base focus:outline-none focus:border-emerald-500/50 transition-colors h-24 resize-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Picture URL</label>
                              <input 
                                type="text"
                                value={settings.profile.picture}
                                onChange={(e) => setSettings(s => ({ ...s, profile: { ...s.profile, picture: e.target.value } }))}
                                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-base focus:outline-none focus:border-emerald-500/50 transition-colors"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">NIP-05</label>
                                <input 
                                  type="text"
                                  value={settings.profile.nip05}
                                  onChange={(e) => setSettings(s => ({ ...s, profile: { ...s.profile, nip05: e.target.value } }))}
                                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-base focus:outline-none focus:border-emerald-500/50 transition-colors"
                                  placeholder="user@domain.com"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Lightning (LUD-16)</label>
                                <input 
                                  type="text"
                                  value={settings.profile.lud16 || ''}
                                  onChange={(e) => setSettings(s => ({ ...s, profile: { ...s.profile, lud16: e.target.value } }))}
                                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-base focus:outline-none focus:border-emerald-500/50 transition-colors"
                                  placeholder="user@getalby.com"
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {personaSubTab === 'prompt' && (
                        <motion.div 
                          key="prompt"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-4"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">System Prompt</h4>
                              <div className="flex gap-2">
                                <code className="text-[11px] px-1.5 py-0.5 bg-zinc-800 rounded text-pink-400">{"{name}"}</code>
                                <code className="text-[11px] px-1.5 py-0.5 bg-zinc-800 rounded text-pink-400">{"{target_name}"}</code>
                              </div>
                            </div>
                            <textarea
                              value={settings.aiSystemPrompt}
                              onChange={(e) => setSettings(s => ({ ...s, aiSystemPrompt: e.target.value }))}
                              className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-base focus:outline-none focus:border-emerald-500/50 transition-colors min-h-[300px] leading-relaxed text-zinc-300 custom-scrollbar"
                              placeholder="Describe how the AI should behave..."
                            />
                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-2">
                              <div className="flex items-center gap-2 text-emerald-500/80">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span className="text-xs font-bold uppercase tracking-widest">Bot Tip</span>
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed">
                                Operational rules (no meta-talk, etc.) are applied automatically. Use this space strictly to define your character's personality and vibe.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {personaSubTab === 'tuning' && (
                        <motion.div 
                          key="tuning"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-6"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            {Object.keys(MODEL_PRESETS[settings.modelId] || {}).map((preset) => (
                              <button
                                key={preset}
                                onClick={() => setSettings(s => ({ ...s, ...MODEL_PRESETS[s.modelId][preset] }))}
                                className={cn(
                                  "px-3 py-2 rounded-xl border text-xs font-bold uppercase transition-all",
                                  Object.entries(MODEL_PRESETS[settings.modelId][preset]).every(([k, v]) => (settings as any)[k] === v)
                                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                                    : "bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                )}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-5 px-1">
                            {[
                              { 
                                label: 'Temperature', 
                                key: 'temperature', 
                                min: 0, max: 2, step: 0.01,
                                tip: 'Controls randomness. Higher values (e.g. 1.0) make output more creative, lower values (e.g. 0.2) make it more focused and deterministic.'
                              },
                              { 
                                label: 'Top-P (Nucleus)', 
                                key: 'top_p', 
                                min: 0, max: 1, step: 0.01,
                                tip: 'Limits vocabulary to a subset whose cumulative probability is P. Helps balance diversity and quality.'
                              },
                              { 
                                label: 'Top-K', 
                                key: 'top_k', 
                                min: 1, max: 100, step: 1,
                                tip: 'Restricts the model to the top K most likely next tokens. Lower values make output more predictable.'
                              },
                              { 
                                label: 'Repetition Penalty', 
                                key: 'repetition_penalty', 
                                min: 1, max: 2, step: 0.01,
                                tip: 'Discourages the model from repeating the same words or phrases. Higher values (e.g. 1.2) reduce loopiness.'
                              },
                              { 
                                label: 'Presence Penalty', 
                                key: 'presence_penalty', 
                                min: -2, max: 2, step: 0.01,
                                tip: 'Positive values increase the model\'s likelihood of talking about new topics.'
                              },
                              { 
                                label: 'Frequency Penalty', 
                                key: 'frequency_penalty', 
                                min: -2, max: 2, step: 0.01,
                                tip: 'Reduces the chance of the model repeating the exact same lines of text.'
                              },
                            ].map((param) => (
                              <div key={param.key} className="space-y-2">
                                <div className="flex justify-between items-center group/tip relative">
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">{param.label}</label>
                                    <div className="relative group/icon">
                                      <Info className="w-3 h-3 text-zinc-600 hover:text-emerald-500 cursor-help transition-colors" />
                                      <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 font-medium leading-relaxed shadow-xl opacity-0 group-hover/icon:opacity-100 pointer-events-none transition-opacity z-50">
                                        {param.tip}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-xs font-mono text-emerald-500">{(settings as any)[param.key].toFixed(param.step < 1 ? 2 : 0)}</span>
                                </div>
                                <input 
                                  type="range" min={param.min} max={param.max} step={param.step}
                                  value={(settings as any)[param.key]}
                                  onChange={(e) => setSettings(s => ({ ...s, [param.key]: parseFloat(e.target.value) }))}
                                  className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {personaSubTab === 'behavior' && (
                        <motion.div
                          key="behavior"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-6"
                        >
                          <div className="space-y-4">
                            {/* Reactions Toggle */}
                            <label className="flex items-center justify-between p-4 bg-black border border-zinc-800 rounded-2xl cursor-pointer hover:border-zinc-700 transition-colors">
                              <div className="space-y-1">
                                <div className="text-base font-bold text-white uppercase tracking-wider">Enable Reactions</div>
                                <div className="text-xs text-zinc-500 text-balance">The bot will send your custom emojis to the target's notes.</div>
                              </div>
                              <div className={cn(
                                "w-10 h-5 rounded-full transition-all relative",
                                settings.reactToNotes ? "bg-emerald-500" : "bg-zinc-800"
                              )}>
                                <input 
                                  type="checkbox" 
                                  checked={settings.reactToNotes}
                                  onChange={(e) => setSettings(s => ({ ...s, reactToNotes: e.target.checked }))}
                                  className="sr-only"
                                />
                                <div className={cn(
                                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                  settings.reactToNotes ? "left-6" : "left-1"
                                )} />
                              </div>
                            </label>

                            {settings.reactToNotes && (
                              <div className="space-y-4 p-1">
                                <div className="space-y-2">
                                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Custom Emojis Pool</label>
                                  <div className="flex gap-2">
                                    <input 
                                      type="text"
                                      value={settings.reactionEmojis}
                                      onChange={(e) => setSettings(s => ({ ...s, reactionEmojis: e.target.value }))}
                                      className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
                                      placeholder="❤️ 🔥 👍"
                                    />
                                    <button 
                                      onClick={() => setShowEmojiPickerDialog(true)}
                                      className="px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700 flex items-center justify-center"
                                    >
                                      <Sparkles className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Repost Toggle */}
                            <label className="flex items-center justify-between p-4 bg-black border border-zinc-800 rounded-2xl cursor-pointer hover:border-zinc-700 transition-colors">
                              <div className="space-y-1">
                                <div className="text-base font-bold text-white uppercase tracking-wider">Enable Reposting</div>
                                <div className="text-xs text-zinc-500 text-balance">The bot will occasionally repost the target's new notes to its own timeline.</div>
                              </div>
                              <div className={cn(
                                "w-10 h-5 rounded-full transition-all relative",
                                settings.repostNotes ? "bg-emerald-500" : "bg-zinc-800"
                              )}>
                                <input 
                                  type="checkbox" 
                                  checked={settings.repostNotes}
                                  onChange={(e) => setSettings(s => ({ ...s, repostNotes: e.target.checked }))}
                                  className="sr-only"
                                />
                                <div className={cn(
                                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                  settings.repostNotes ? "left-6" : "left-1"
                                )} />
                              </div>
                            </label>

                            {/* Auto Follow Back Toggle */}
                            <label className="flex items-center justify-between p-4 bg-black border border-zinc-800 rounded-2xl cursor-pointer hover:border-zinc-700 transition-colors">
                              <div className="space-y-1">
                                <div className="text-base font-bold text-white uppercase tracking-wider">Follow Back Users</div>
                                <div className="text-xs text-zinc-500 text-balance">Automatically follow users who interact with the bot's notes.</div>
                              </div>
                              <div className={cn(
                                "w-10 h-5 rounded-full transition-all relative",
                                settings.autoFollowBack ? "bg-emerald-500" : "bg-zinc-800"
                              )}>
                                <input 
                                  type="checkbox" 
                                  checked={settings.autoFollowBack}
                                  onChange={(e) => setSettings(s => ({ ...s, autoFollowBack: e.target.checked }))}
                                  className="sr-only"
                                />
                                <div className={cn(
                                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                  settings.autoFollowBack ? "left-6" : "left-1"
                                )} />
                              </div>
                            </label>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="p-4 bg-black/40 border-t border-zinc-800/50 flex flex-col gap-3">
                    {userPubkey ? (
                      <button
                        onClick={publishPersona}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-black rounded-xl font-bold text-xs hover:bg-emerald-400 transition-all uppercase tracking-widest shadow-lg shadow-emerald-500/10"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Publish Persona to Network
                      </button>
                    ) : (
                      <button
                        onClick={handleNip07Login}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 text-zinc-400 rounded-xl font-bold text-xs hover:bg-zinc-700 hover:text-white transition-all uppercase tracking-widest"
                      >
                        <User className="w-3.5 h-3.5" />
                        Sign In to Publish
                      </button>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => setShowAddIdentityDialog(true)}
                        className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-full font-semibold text-[10px] hover:bg-zinc-700 hover:text-white transition-all flex items-center gap-2 uppercase tracking-widest"
                      >
                        <Plus className="w-3 h-3" />
                        Create New Bot
                      </button>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 italic">Settings save automatically</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Unified Identity & Discovery Manager */}
      <AnimatePresence>
        {showManager && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-12 bg-black/80 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-zinc-900 border border-zinc-800 md:rounded-3xl w-full h-full max-w-6xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Header / Tabs */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-xl font-bold text-white tracking-tight">Bot Central</h3>
                  </div>
                  <nav className="flex gap-1 p-1 bg-black/40 rounded-xl border border-zinc-800">
                    <button 
                      onClick={() => setManagerTab('local')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                        managerTab === 'local' ? "bg-zinc-800 text-emerald-400 shadow-inner" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <Users className="w-3.5 h-3.5" />
                      My Identities
                    </button>
                    <button 
                      onClick={() => {
                        setManagerTab('community');
                        fetchCommunityPersonas();
                      }}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                        managerTab === 'community' ? "bg-zinc-800 text-emerald-400 shadow-inner" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Marketplace
                    </button>
                  </nav>
                </div>
                <div className="flex items-center gap-4">
                  {managerTab === 'community' && (
                    <button 
                      onClick={fetchCommunityPersonas}
                      disabled={isDiscovering}
                      className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white disabled:opacity-50"
                    >
                      <RefreshCw className={cn("w-4 h-4", isDiscovering && "animate-spin")} />
                    </button>
                  )}
                  <button onClick={() => setShowManager(false)} className="text-zinc-500 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-hidden flex">
                {managerTab === 'local' ? (
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center bg-black/20">
                      <div className="space-y-0.5">
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Saved Bots ({savedIdentities.filter(i => !i.deleted).length})</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            const name = prompt('Enter a name for this bot:');
                            if (name) saveIdentity(name);
                          }}
                          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center gap-2 border border-zinc-700"
                        >
                          <Save className="w-3 h-3" />
                          Save Current
                        </button>
                        <button 
                          onClick={() => {
                            setShowManager(false);
                            setShowAddIdentityDialog(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center gap-2"
                        >
                          <Plus className="w-3 h-3" />
                          New Bot
                        </button>
                        {lastSyncTime > 0 && (
                          <div className="hidden md:flex flex-col items-end opacity-40 px-2 border-l border-zinc-800">
                            <span className="text-[8px] font-bold uppercase tracking-tighter">Last Synced</span>
                            <span className="text-[9px] font-medium">{new Date(lastSyncTime).toLocaleString()}</span>
                          </div>
                        )}
                        <button
                          onClick={syncWithCloud}
                          disabled={isSyncing || !userPubkey}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 border",
                            isSyncing 
                              ? "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed"
                              : "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500 hover:text-black hover:border-purple-500"
                          )}
                        >
                          <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
                          {isSyncing ? "Syncing..." : "Sync to Cloud"}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      {savedIdentities.filter(i => !i.deleted).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-3 opacity-30">
                          <Users className="w-12 h-12" />
                          <p className="text-sm font-medium italic">No saved bots yet.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {savedIdentities.filter(i => !i.deleted).map((identity) => (
                            <div 
                              key={identity.id}
                              className={cn(
                                "group p-4 rounded-3xl border transition-all flex flex-col gap-4 relative overflow-hidden",
                                activeIdentityId === identity.id 
                                  ? "bg-emerald-500/5 border-emerald-500/30" 
                                  : "bg-black/40 border-zinc-800 hover:border-zinc-700"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <img 
                                  src={identity.settings.profile.picture} 
                                  alt="" 
                                  className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 object-cover"
                                  crossOrigin="anonymous"
                                />
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-base font-bold text-white truncate">{identity.name}</h4>
                                  <p className="text-[10px] text-zinc-500 font-mono truncate">{nip19.npubEncode(getPublicKey(nip19.decode(identity.nsec).data as any)).substring(0, 14)}...</p>
                                </div>
                                
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {activeIdentityId !== identity.id && (
                                    <button 
                                      onClick={() => loadIdentity(identity)}
                                      className="p-2 bg-zinc-800 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-black transition-all shadow-lg"
                                      title="Load Identity"
                                    >
                                      <Play className="w-4 h-4 fill-current" />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => deleteIdentity(identity.id)}
                                    className="p-2 bg-zinc-800 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Stats Infocard */}
                              <div className="grid grid-cols-2 gap-2 p-3 bg-black/40 border border-zinc-800/50 rounded-2xl">
                                <div className="space-y-0.5 border-r border-zinc-800/50 pr-2">
                                  <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Sent</p>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1" title="Replies Sent">
                                      <MessageSquare className="w-2.5 h-2.5 text-emerald-500" />
                                      <span className="text-xs font-bold text-zinc-300">{sumStats(identity.stats?.repliesSent)}</span>
                                    </div>
                                    <div className="flex items-center gap-1" title="Reactions Sent">
                                      <Heart className="w-2.5 h-2.5 text-pink-500" />
                                      <span className="text-xs font-bold text-zinc-300">{sumStats(identity.stats?.reactionsSent)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-0.5 pl-1">
                                  <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Received</p>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1" title="Replies Received">
                                      <MessageSquare className="w-2.5 h-2.5 text-emerald-500 fill-current opacity-20" />
                                      <span className="text-xs font-bold text-zinc-300">{sumStats(identity.stats?.repliesReceived)}</span>
                                    </div>
                                    <div className="flex items-center gap-1" title="Reactions Received">
                                      <Heart className="w-2.5 h-2.5 text-pink-500 fill-current opacity-20" />
                                      <span className="text-xs font-bold text-zinc-300">{sumStats(identity.stats?.reactionsReceived)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {activeIdentityId === identity.id && (
                                <div className="absolute top-0 right-0 p-1.5">
                                  <span className="px-2 py-0.5 bg-emerald-500 text-black text-[8px] font-black uppercase tracking-tighter rounded-bl-lg shadow-lg">Active</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center bg-black/20">
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Community Marketplace</p>
                      <div className="flex items-center gap-3">
                        {!userPubkey && (
                          <button 
                            onClick={handleNip07Login}
                            className="text-[10px] font-bold text-emerald-500 hover:underline uppercase tracking-widest"
                          >
                            Sign In to Publish
                          </button>
                        )}
                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Kind 38752</span>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      {isDiscovering && communityPersonas.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-40">
                          <RefreshCw className="w-12 h-12 animate-spin text-emerald-500" />
                          <p className="text-xs font-bold uppercase tracking-widest">Scanning Network...</p>
                        </div>
                      ) : communityPersonas.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-3 opacity-30">
                          <Sparkles className="w-12 h-12" />
                          <p className="text-sm font-medium italic">No community personas found.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {communityPersonas.map((persona) => (
                            <div 
                              key={persona.id}
                              className="group bg-black/40 border border-zinc-800 rounded-3xl hover:border-emerald-500/30 transition-all flex min-h-[160px] overflow-hidden"
                            >
                              {/* Left Content Area */}
                              <div className="flex-1 flex flex-col p-4 min-w-0">
                                <div className="flex items-center gap-3 mb-3">
                                  <img 
                                    src={persona.settings.profile.picture} 
                                    alt="" 
                                    className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 object-cover"
                                    crossOrigin="anonymous"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="text-[8px] font-bold uppercase tracking-tighter px-1 py-0.5 bg-purple-500/10 text-purple-400 rounded-md border border-purple-500/20 whitespace-nowrap">
                                        {SUPPORTED_MODELS.find(m => m.id === persona.settings.modelId)?.name.split(' ').pop() || '270M'}
                                      </span>
                                      <h4 className="text-sm font-bold text-white truncate">{persona.settings.profile.name}</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5 opacity-90 group/author">
                                      <span className="text-[10px] text-zinc-500 font-medium">by</span>
                                      <img 
                                        src={communityProfiles[persona.author]?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${persona.author}`} 
                                        alt="Creator" 
                                        className="w-3.5 h-3.5 rounded-full bg-zinc-800 border border-zinc-700/50"
                                        crossOrigin="anonymous"
                                      />
                                      <p className="text-[11px] text-zinc-300 font-bold truncate group-hover/author:text-emerald-400 transition-colors underline underline-offset-2 decoration-zinc-700 group-hover/author:decoration-emerald-500/50">
                                        {communityProfiles[persona.author]?.name || `${persona.author.substring(0, 8)}...`}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <p className="text-[11px] text-zinc-400 line-clamp-2 italic leading-snug flex-1">
                                  {persona.settings.profile.about}
                                </p>

                                <div className="pt-3 flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setZapData({ 
                                        personaId: persona.id, 
                                        author: persona.author, 
                                        amount: 21, 
                                        comment: `Zapping ${persona.settings.profile.name}` 
                                      });
                                      setShowZapDialog(true);
                                    }}
                                    className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500 hover:text-black hover:border-amber-500 transition-all shadow-lg"
                                    title="Send Zap"
                                  >
                                    <Zap className="w-4 h-4 fill-current" />
                                  </button>
                                  <button
                                    onClick={() => importPersona(persona)}
                                    className="flex-1 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-[10px] font-bold uppercase tracking-widest text-zinc-300 hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all shadow-lg"
                                  >
                                    Import Persona
                                  </button>
                                  {userPubkey === persona.author && (
                                    <button
                                      onClick={() => unpublishPersona(persona.event)}
                                      className="p-2 bg-red-900/20 border border-red-500/20 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                      title="Unpublish"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Right Vote Bar */}
                              <div className="w-12 flex flex-col items-center justify-between py-4 bg-black/40 border-l border-zinc-800/50">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handlePersonaVote(persona.event, '+'); }}
                                  className={cn(
                                    "p-2 rounded-xl transition-all",
                                    personaVotes[persona.id]?.userVote === '+'
                                      ? "text-emerald-500 bg-emerald-500/10"
                                      : "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
                                  )}
                                  title="Upvote"
                                >
                                  <ChevronUp className="w-5 h-5" />
                                </button>
                                
                                <span className={cn(
                                  "text-xs font-black font-mono tracking-tighter",
                                  (personaVotes[persona.id]?.up || 0) - (personaVotes[persona.id]?.down || 0) > 0 ? "text-emerald-500" :
                                  (personaVotes[persona.id]?.up || 0) - (personaVotes[persona.id]?.down || 0) < 0 ? "text-red-500" : "text-zinc-600"
                                )}>
                                  {(personaVotes[persona.id]?.up || 0) - (personaVotes[persona.id]?.down || 0)}
                                </span>

                                <button 
                                  onClick={(e) => { e.stopPropagation(); handlePersonaVote(persona.event, '-'); }}
                                  className={cn(
                                    "p-2 rounded-xl transition-all",
                                    personaVotes[persona.id]?.userVote === '-'
                                      ? "text-red-500 bg-red-500/10"
                                      : "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
                                  )}
                                  title="Downvote"
                                >
                                  <ChevronDown className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex justify-between items-center px-6">
                <div className="flex items-center gap-4 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Local Database Sync
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    Nostr Discovery Active
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">v0.1.2</span>
                  <p className="text-[10px] text-zinc-500">Press ESC or click close to return</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Add New Identity Selection Dialog */}
      <AnimatePresence>
        {showAddIdentityDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Create New Bot</h3>
                <button onClick={() => setShowAddIdentityDialog(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 space-y-4">
                <button 
                  onClick={() => createNewIdentity('waifu')}
                  className="w-full flex items-center gap-4 p-4 bg-pink-500/10 border border-pink-500/20 rounded-2xl hover:bg-pink-500/20 transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20 group-hover:scale-110 transition-transform">
                    <Wand2 className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-bold text-white">Random Waifu</div>
                    <div className="text-xs text-pink-400/70 font-medium">Instant bubbly personality & profile.</div>
                  </div>
                </button>

                <button 
                  onClick={() => createNewIdentity('custom')}
                  className="w-full flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/20 transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6 text-black" />
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-bold text-white">Custom Bot</div>
                    <div className="text-xs text-emerald-400/70 font-medium">Start fresh and build your own.</div>
                  </div>
                </button>
              </div>
              
              <div className="p-6 bg-zinc-950 flex justify-center">
                <button 
                  onClick={() => setShowAddIdentityDialog(false)}
                  className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Dialog */}
      <AnimatePresence>
        {showSettingsDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Bot Configuration</h3>
                <button onClick={() => setShowSettingsDialog(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex border-b border-zinc-800">
                <button 
                  onClick={() => setSettingsTab('general')}
                  className={cn(
                    "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all",
                    settingsTab === 'general' ? "text-emerald-500 border-b-2 border-emerald-500" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  General
                </button>
                <button 
                  onClick={() => setSettingsTab('ai')}
                  className={cn(
                    "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all",
                    settingsTab === 'ai' ? "text-emerald-500 border-b-2 border-emerald-500" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  AI Brain
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
                {settingsTab === 'general' ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Clock className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-widest">Reply Delay (Seconds)</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Minimum</label>
                          <input 
                            type="number"
                            value={settings.minDelay}
                            onChange={(e) => setSettings(s => ({ ...s, minDelay: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-1.5 text-base focus:outline-none focus:border-emerald-500/50 transition-colors"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500">Maximum</label>
                          <input 
                            type="number"
                            value={settings.maxDelay}
                            onChange={(e) => setSettings(s => ({ ...s, maxDelay: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-1.5 text-base focus:outline-none focus:border-emerald-500/50 transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-bold uppercase tracking-widest">Payments</h4>
                      </div>
                      <div className="space-y-2">
                        <label className={cn(
                          "flex items-center justify-between p-3 bg-black border border-zinc-800 rounded-2xl transition-colors",
                          (!curatorProfile?.lud16) ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-zinc-700"
                        )}>
                          <div className="space-y-0.5">
                            <div className="text-sm font-medium text-white">Use Curator Lightning Address</div>
                            <div className="text-[11px] text-zinc-500">
                              {!userPubkey ? "Sign in to sync your lightning address." :
                               curatorProfile === null ? "Fetching curator profile..." :
                               curatorProfile?.lud16 
                                ? `Syncs ${curatorProfile.lud16} to this bot.` 
                                : "No lightning address found in your Nostr profile."}
                            </div>
                          </div>
                          <div className={cn(
                            "w-8 h-4 rounded-full transition-all relative",
                            globalUseCuratorLightning ? "bg-emerald-500" : "bg-zinc-800"
                          )}>
                            <input 
                              type="checkbox"
                              checked={globalUseCuratorLightning}
                              disabled={!curatorProfile?.lud16}
                              onChange={(e) => setGlobalUseCuratorLightning(e.target.checked)}
                              className="sr-only"
                            />
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                              globalUseCuratorLightning ? "left-4.5" : "left-0.5"
                            )} />
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-800/50 space-y-3">
                      <div className="flex items-center gap-2 text-red-500/80">
                        <AlertCircle className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-widest">Danger Zone</h4>
                      </div>
                      <button
                        onClick={handleFreshStart}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-900/20 text-red-500 border border-red-500/20 rounded-xl font-bold text-xs hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest shadow-lg shadow-red-500/5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Fresh Start
                      </button>
                      <p className="text-[10px] text-zinc-600 font-medium text-center italic">Clears all local data and resets the app.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Brain className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">AI Model</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-2">
                          {SUPPORTED_MODELS.map((model) => {
                            const isSelected = settings.modelId === model.id;
                            const isReady = isSelected && aiStatus === 'ready';
                            const isLoading = isSelected && aiStatus === 'loading';

                            return (
                              <div
                                key={model.id}
                                className={cn(
                                  "p-3 rounded-2xl border transition-all flex flex-col gap-3",
                                  isSelected
                                    ? "bg-emerald-500/5 border-emerald-500/30"
                                    : "bg-black border-zinc-800"
                                )}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className={cn(
                                        "text-sm font-bold uppercase tracking-widest",
                                        isSelected ? "text-emerald-500" : "text-white"
                                      )}>
                                        {model.name}
                                      </span>
                                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded leading-none">{model.size}</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-500 leading-tight line-clamp-2">{model.description}</p>
                                  </div>
                                  
                                  <div className="shrink-0">
                                    {isReady ? (
                                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Loaded</span>
                                      </div>
                                    ) : isLoading ? (
                                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg">
                                        <RefreshCw className="w-2.5 h-2.5 animate-spin text-zinc-400" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{Math.round(aiProgress)}%</span>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={() => {
                                          setSettings(s => ({ ...s, modelId: model.id, useAI: true }));
                                          if (aiStatus !== 'idle') setAiStatus('idle'); // Force reset to trigger load
                                        }}
                                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border border-zinc-700"
                                      >
                                        Load Model
                                      </button>
                                    )}                                  </div>
                                </div>

                                {isLoading && (
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between text-[9px] uppercase font-bold tracking-widest text-zinc-500 px-0.5">
                                      <span className="truncate max-w-[180px]">{currentLoadingFile ? `Fetching ${currentLoadingFile}...` : 'Initializing...'}</span>
                                    </div>
                                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-emerald-500 transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                                        style={{ width: `${aiProgress}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-end">
                <button 
                  onClick={() => setShowSettingsDialog(false)}
                  className="px-6 py-2 bg-emerald-500 text-black rounded-full font-bold text-base hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10"
                >
                  Apply Settings
                </button>
              </div>            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEmojiPickerDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Emoji Picker</h3>
                <button onClick={() => setShowEmojiPickerDialog(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <input 
                  type="text"
                  placeholder="Search emojis (e.g. 'heart', 'smile')..."
                  value={emojiSearchQuery}
                  onChange={(e) => setEmojiSearchQuery(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-base focus:outline-none focus:border-emerald-500/50 transition-colors"
                  autoFocus
                />
                
                <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {!emojiSearchQuery && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Popular</h4>
                      <div className="grid grid-cols-8 gap-2">
                        {POPULAR_EMOJIS.map((emoji, idx) => {
                          const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                          const currentEmojis = [...segmenter.segment(settings.reactionEmojis)].map(s => s.segment).filter(c => c.trim() !== '');
                          const isActive = currentEmojis.includes(emoji);

                          return (
                            <button 
                              key={idx}
                              onClick={() => {
                                if (isActive) {
                                  setSettings(s => ({ ...s, reactionEmojis: currentEmojis.filter(e => e !== emoji).join(' ') }));
                                } else {
                                  setSettings(s => ({ ...s, reactionEmojis: [...currentEmojis, emoji].join(' ') }));
                                }
                              }}
                              className={cn(                                "w-9 h-9 flex items-center justify-center rounded-lg text-xl transition-all",
                                isActive 
                                  ? "bg-emerald-500/20 text-white border border-emerald-500/30 scale-110" 
                                  : "bg-black hover:bg-zinc-800 text-zinc-400 border border-zinc-800"
                              )}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {emojiSearchQuery && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Search Results</h4>
                      <div className="grid grid-cols-8 gap-2">
                        {EMOJI_DATA.filter(e => e.k.includes(emojiSearchQuery.toLowerCase())).map((item, idx) => {
                          const emoji = item.c;
                          const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                          const currentEmojis = [...segmenter.segment(settings.reactionEmojis)].map(s => s.segment).filter(c => c.trim() !== '');
                          const isActive = currentEmojis.includes(emoji);

                          return (
                            <button 
                              key={idx}
                              onClick={() => {
                                if (isActive) {
                                  setSettings(s => ({ ...s, reactionEmojis: currentEmojis.filter(e => e !== emoji).join(' ') }));
                                } else {
                                  setSettings(s => ({ ...s, reactionEmojis: [...currentEmojis, emoji].join(' ') }));
                                }
                              }}
                              className={cn(                                "w-9 h-9 flex items-center justify-center rounded-lg text-xl transition-all",
                                isActive 
                                  ? "bg-emerald-500/20 text-white border border-emerald-500/30 scale-110" 
                                  : "bg-black hover:bg-zinc-800 text-zinc-400 border border-zinc-800"
                              )}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-zinc-950 flex justify-end">
                <button 
                  onClick={() => {
                    setShowEmojiPickerDialog(false);
                    setEmojiSearchQuery('');
                  }}
                  className="px-6 py-2 bg-emerald-500 text-black rounded-full font-semibold text-base hover:bg-emerald-400 transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zap Dialog */}
      <AnimatePresence>
        {showZapDialog && zapData && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500 fill-current" />
                  <h3 className="text-xl font-bold text-white tracking-tight">Send Zap</h3>
                </div>
                <button onClick={() => setShowZapDialog(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3 p-3 bg-black/40 border border-zinc-800 rounded-2xl">
                  <img 
                    src={communityProfiles[zapData.author]?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${zapData.author}`} 
                    alt="" 
                    className="w-8 h-8 rounded-full border border-zinc-700"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{communityProfiles[zapData.author]?.name || 'Anonymous'}</p>
                    <p className="text-[10px] text-amber-500 font-medium truncate uppercase tracking-tight">
                      {communityProfiles[zapData.author]?.lud16 || 'Lightning Enabled'}
                    </p>
                  </div>
                </div>

                {!zapData.invoice ? (
                  <>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Select Amount</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[21, 100, 1000, 5000].map(amt => (
                          <button
                            key={amt}
                            onClick={() => setZapData({ ...zapData, amount: amt })}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold transition-all border",
                              zapData.amount === amt 
                                ? "bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20" 
                                : "bg-black/40 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                            )}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <input 
                          type="number"
                          value={zapData.amount}
                          onChange={(e) => setZapData({ ...zapData, amount: parseInt(e.target.value) || 0 })}
                          className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-lg font-bold text-white focus:outline-none focus:border-amber-500/50 transition-colors pr-16"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs">SATS</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Message (Optional)</label>
                      <textarea 
                        value={zapData.comment}
                        onChange={(e) => setZapData({ ...zapData, comment: e.target.value })}
                        placeholder="Say something nice..."
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors resize-none h-20"
                      />
                    </div>

                    <button
                      onClick={() => getZapInvoice(zapData.personaId, zapData.author, zapData.amount, zapData.comment)}
                      disabled={zapData.isPaying || zapData.amount <= 0}
                      className="w-full py-4 bg-amber-500 text-black rounded-2xl font-bold text-lg hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {zapData.isPaying ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Zap className="w-5 h-5 fill-current" />
                          Generate Invoice
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center space-y-6 animate-in fade-in zoom-in duration-300">
                    <div className="p-4 bg-white rounded-3xl shadow-2xl">
                      <QRCodeSVG 
                        value={zapData.invoice.toUpperCase()} 
                        size={200}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    
                    <div className="text-center space-y-2">
                      <p className="text-xs text-zinc-500 font-medium">Scan with any Bitcoin Lightning wallet</p>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(zapData.invoice!);
                            addLog('Invoice copied to clipboard.', 'success');
                          }}
                          className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-700 transition-all border border-zinc-700"
                        >
                          Copy Invoice
                        </button>
                        <a 
                          href={`lightning:${zapData.invoice}`}
                          className="px-4 py-2 bg-amber-500 text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-amber-400 transition-all"
                        >
                          Open Wallet
                        </a>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setShowZapDialog(false);
                        setZapData(null);
                      }}
                      className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {zapData.error && (
                  <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-widest text-center">
                    {zapData.error}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Zap Success Animation Overlay */}
      <AnimatePresence>
        {showZapSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center bg-emerald-500/10 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -20 }}
              animate={{ scale: 1.5, rotate: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-24 h-24 bg-amber-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.5)] border-4 border-white animate-bounce">
                <Zap className="w-12 h-12 text-black fill-current" />
              </div>
              <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-2xl">Zapped!</h2>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>

      {/* Onboarding Wizard */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingWizard
            onFinish={handleFinishOnboarding}
            defaultSettings={DEFAULT_SETTINGS}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Onboarding Component ---

function OnboardingWizard({ onFinish, defaultSettings }: { onFinish: (settings: BotSettings) => void, defaultSettings: BotSettings }) {
  const [step, setStep] = useState(1);
  const [tempSettings, setTempSettings] = useState<BotSettings>({
    ...defaultSettings,
    modelId: 'onnx-community/SmolLM2-360M-Instruct-ONNX', // Default to balanced
    profile: {
      ...defaultSettings.profile,
      name: 'My EchoBot'
    }
  });

  const deviceCores = navigator.hardwareConcurrency || 4;
  const deviceMemory = (navigator as any).deviceMemory || 0;

  const handleFinish = () => {
    onFinish(tempSettings);
  };

  const modelCards = [
    {
      id: 'onnx-community/gemma-3-270m-it-ONNX',
      name: 'Lightweight',
      modelName: 'Gemma 3 270M',
      description: 'Fastest with the lowest memory usage. Ideal for older devices or quick, simple replies.',
      recommended: deviceMemory > 0 && deviceMemory < 4,
    },
    {
      id: 'onnx-community/SmolLM2-360M-Instruct-ONNX',
      name: 'Balanced',
      modelName: 'SmolLM2 360M',
      description: 'The sweet spot. Great performance and instruction-following for most modern desktops and laptops.',
      recommended: (deviceMemory === 0) || (deviceMemory >= 4 && deviceMemory < 8),
    },
    {
      id: 'onnx-community/Llama-3.2-1B-Instruct',
      name: 'Powerhouse',
      modelName: 'Llama 3.2 1B',
      description: 'Superior reasoning and personality. Recommended for devices with a fast CPU and 8GB+ RAM.',
      recommended: deviceMemory >= 8,
    }
  ];

  const personaVibes = [
    { name: 'Helpful Assistant', prompt: MODEL_DEFAULT_PROMPTS[tempSettings.modelId]?.neutral || MODEL_DEFAULT_PROMPTS[modelCards[0].id].neutral },
    { name: 'Playful Waifu', prompt: MODEL_DEFAULT_PROMPTS[tempSettings.modelId]?.waifu || MODEL_DEFAULT_PROMPTS[modelCards[0].id].waifu },
    { name: 'Concise & Professional', prompt: 'You are {name}, a highly professional AI. Your responses are always concise, clear, and focused on the query. You do not use slang or emojis.' },
    { name: 'Chaotic Gremlin', prompt: 'You are {name}, a chaotic gremlin. You love short, witty, and slightly unhinged replies. You use a lot of memespeak and lowercase letters.' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" exit={{ opacity: 0, x: -50 }} className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-white">Welcome to EchoBot</h1>
                <p className="text-lg text-zinc-400">Let's set up your first autonomous AI persona.</p>
              </div>
              <div className="p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-3xl space-y-5">
                <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Step 1: Choose a Brain
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {modelCards.map(card => (
                    <button
                      key={card.id}
                      onClick={() => setTempSettings(s => ({ ...s, modelId: card.id }))}
                      className={cn(
                        "p-4 rounded-2xl border transition-all text-left space-y-2",
                        tempSettings.modelId === card.id 
                          ? "bg-emerald-500/10 border-emerald-500/50" 
                          : "bg-black/50 border-zinc-800 hover:border-zinc-700"
                      )}
                    >
                      <h3 className="text-base font-bold text-white">{card.name}</h3>
                      <p className="text-[11px] text-zinc-400 font-medium">{card.modelName}</p>
                      <p className="text-xs text-zinc-500">{card.description}</p>
                      {card.recommended && (
                        <div className="pt-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full">Recommended</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-center text-zinc-600 font-mono">
                  Device: {deviceCores} Cores / {deviceMemory > 0 ? `${deviceMemory}GB RAM` : 'RAM N/A'}
                </p>
              </div>
              <div className="text-center">
                <button
                  onClick={() => setStep(2)}
                  className="px-8 py-3 bg-emerald-500 text-black rounded-full font-bold text-lg hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                  Next: Create Persona
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-white">Bot Persona</h1>
                <p className="text-lg text-zinc-400">Give your AI a name and a starting personality.</p>
              </div>
              <div className="p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-3xl space-y-5">
                <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Step 2: Choose a Soul
                </h2>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Bot Name</label>
                  <input 
                    type="text"
                    value={tempSettings.profile.name}
                    onChange={(e) => setTempSettings(s => ({ ...s, profile: { ...s.profile, name: e.target.value } }))}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Starting Vibe</label>
                  <div className="grid grid-cols-2 gap-3">
                    {personaVibes.map(vibe => (
                      <button
                        key={vibe.name}
                        onClick={() => setTempSettings(s => ({ ...s, aiSystemPrompt: vibe.prompt }))}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all",
                          tempSettings.aiSystemPrompt === vibe.prompt
                            ? "bg-emerald-500/10 border-emerald-500/50" 
                            : "bg-black/50 border-zinc-800 hover:border-zinc-700"
                        )}
                      >
                        <h4 className="text-sm font-bold text-white">{vibe.name}</h4>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-center items-center gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-full font-bold text-base hover:bg-zinc-700 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  className="px-8 py-3 bg-emerald-500 text-black rounded-full font-bold text-lg hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                  Finish & Launch
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
