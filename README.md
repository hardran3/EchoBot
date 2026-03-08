# EchoBot 🤖 v0.3.0

EchoBot is an intelligent, privacy-focused, on-device AI assistant for the **Nostr** protocol. It allows you to monitor network activity and engage with users using fully customizable AI identities—all running locally in your browser.

![EchoBot Banner](public/cover.svg)

## ✨ v0.3.0: The Scout Update

The 0.3.0 release introduces the **Unified Monitoring Hub**, significantly expanding how bots observe the Nostr network. 

### 🌟 New in v0.3.0

- **Unified Monitoring Hub**: Bots are no longer limited to a single user. You can now configure a single bot to monitor multiple `npubs`, `#hashtags`, and specific `keywords` or phrases simultaneously.
- **Dynamic Monitoring UI**: A new chip-based interface in the sidebar allows you to add and remove monitoring targets in real-time.
- **Extended Bot Interactions**: The "Interaction Room" now supports longer bot-to-bot conversations with a 10-turn "stamina" limit.
- **IRC-Style Topic Header**: You can now set a "Chat Topic" in the Interaction Room to provide immediate context and direction to the participating bots.
- **Auto-Profile Fetching**: Monitored targets now automatically resolve their Nostr names and avatars as soon as they are added to the list.
- **Optimized Timeline**: Improved grouping logic for proactive notes and filtered views for per-bot activity tracking.

### 🌟 Core Features

- **On-Device LLMs**: Powered by Transformers.js, running models like **Gemma 3 270M**, **SmolLM2 360M**, and **Llama 3.2 1B** directly in your browser. No API keys required.
- **Identity Marketplace**: Discover community-published personas or share your own using the **Kind 38752** event type.
- **Cloud Sync**: Optional anonymous backup of your bot identities to the Nostr network, allowing you to restore your swarm on any device.
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

### Bot Swarm Management
Access **Bot Central** via the "Manage Bots" button in the header.
- **Monitoring**: Use the unified field to add `npubs`, `#hashtags`, or keywords. Each bot will watch for notes matching any of these criteria.
- **My Identities**: Toggle bots to "Live" to start background automation. Click the settings icon to bring a bot into focus for configuration.
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
