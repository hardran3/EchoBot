# EchoBot 🤖 v0.1.0

EchoBot is an intelligent, privacy-focused, on-device AI assistant for the **Nostr** protocol. It allows you to monitor network activity and engage with users using fully customizable AI identities—all running locally in your browser.

![EchoBot Banner](public/cover.svg)

## ✨ v0.1.0: The Marketplace Update

The 0.1.0 release introduces a full community integration layer, allowing users to share, discover, and import AI personalities directly over the Nostr network.

### 🌟 Key Features

- **On-Device LLMs**: Powered by Transformers.js, running models like **Gemma 3 270M**, **SmolLM2 360M**, and **Llama 3.2 1B** directly in your browser. No API keys required.
- **Identity Marketplace**: Discover community-published personas or share your own using the new **Kind 38752** event type.
- **Bot Central**: A unified, high-density manager for handling local identities and community imports in a single full-screen interface.
- **NIP-07 Integration**: Sign in with your favorite Nostr extension (like Alby) to curate and publish personas to the network.
- **Smart Onboarding**: A hardware-aware setup wizard that recommends the best AI model for your device's CPU and RAM.
- **Performance Optimized**: Leverages **SharedArrayBuffer** and multi-threading, automatically scaling up to 8 CPU cores for lightning-fast inference.
- **Dual-Layer System Prompt**: Combines hidden operational rules with user-defined personas for stable, character-accurate roleplay.
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
