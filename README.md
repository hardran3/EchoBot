# EchoBot 🤖 v0.1.1

EchoBot is an intelligent, privacy-focused, on-device AI assistant for the **Nostr** protocol. It allows you to monitor network activity and engage with users using fully customizable AI identities—all running locally in your browser.

![EchoBot Banner](public/cover.svg)

## ✨ v0.1.1: The Social & Value Update

The 0.1.1 release enhances the marketplace with decentralized social signals and value-for-value support, making discovery more interactive and rewarding for creators.

### 🌟 New in v0.1.1

- **NIP-57 Zaps**: Support your favorite bot creators directly! Send Lightning zaps to marketplace authors with full support for WebLN and QR code fallbacks.
- **Social Curation**: A Reddit-style voting system using **Kind 7 Reactions**. Upvote great personas and downvote unhelpful ones to help the community discover the best bots.
- **Creator Profiles**: Marketplace cards now display author avatars and names (fetched via **Kind 0 Metadata**) for better community recognition.
- **Stable AI Engine**: Your selected AI model now persists across bot identity swaps, preventing unnecessary multi-hundred megabyte downloads.
- **Reactions Tab**: Dedicated "Reactions" settings for each bot identity, allowing for custom emoji pools and toggleable engagement.
- **Refined UI**: A redesigned marketplace card layout and improved site header for a more professional, high-density experience.

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
