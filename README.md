# EchoBot 🤖 v0.1.2

EchoBot is an intelligent, privacy-focused, on-device AI assistant for the **Nostr** protocol. It allows you to monitor network activity and engage with users using fully customizable AI identities—all running locally in your browser.

![EchoBot Banner](public/cover.svg)

## ✨ v0.1.2: The Analytics & Refinement Update

The 0.1.2 release introduces deep bot performance tracking and refined identity management, giving you a clearer picture of your AI's impact on the network.

### 🌟 New in v0.1.2

- **Bot Performance Analytics**: All-time stats tracking for every identity. See exactly how many replies and reactions your bot has sent and received at a glance.
- **Enhanced Identity UI**: Redesigned "My Identities" tab with taller, high-density cards, larger avatars, and integrated stats infocards.
- **Granular Reaction Control**: Removed mandatory auto-reactions. You now have total control over your bot's emoji pool (the "+" is no longer forced).
- **Social Marketplace**: Integrated NIP-57 Zaps and social curation (Kind 7 voting) for a vibrant, value-for-value community experience.

### 🌟 Core Features

- **On-Device LLMs**: Powered by Transformers.js, running models like **Gemma 3 270M**, **SmolLM2 360M**, and **Llama 3.2 1B** directly in your browser. No API keys required.
- **Identity Marketplace**: Discover community-published personas or share your own using the new **Kind 38752** event type.
- **Smart Onboarding**: A hardware-aware setup wizard that recommends the best AI model for your device's CPU and RAM.
- **Performance Optimized**: Leverages **SharedArrayBuffer** and multi-threading, automatically scaling up to 8 CPU cores for lightning-fast inference.
- **Privacy First**: Your keys, bot configurations, and conversation histories never leave your local browser storage.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)
- A modern browser with **SharedArrayBuffer** support (Chrome, Edge, Firefox).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/hardran3/EchoBot.git
   cd EchoBot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

## 🛠️ Management & Tuning

### Bot Central
Access **Bot Central** via the "Manage Bots" button in the header.
- **My Identities**: Load, delete, or save your local bot configurations.
- **Marketplace**: Browse personas published by other curators or publish your own unique character to the network.

### AI Persona Tuning
The **Persona** dashboard provides granular control over your bot's "soul":
- **System Prompt**: Define the character's name, vibe, and goals.
- **Advanced Tuning**: Hover over Temperature, Top-P, and Penalty sliders for tooltips explaining how each affects the AI's creativity and focus.

### Danger Zone
If you need a clean slate, use the **Fresh Start** button in the General settings tab to clear all local cache, identities, and logs.

## 📜 Protocol Details

EchoBot uses specialized Nostr event kinds for its marketplace features:
- **Kind 38752**: AI Persona Definition (contains sanitized JSON configuration).
- **Kind 5**: Deletion requests for unpublishing personas.

## ⚖️ License

MIT

---
*Built with React, TypeScript, Vite, and Hugging Face Transformers.js.*
