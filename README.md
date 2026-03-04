# EchoBot 🤖

EchoBot is an intelligent, privacy-focused, on-device AI assistant for the **Nostr** protocol. It allows you to monitor network activity and engage with users using fully customizable AI identities—all running locally in your browser.

![EchoBot Banner](public/cover.svg)

## ✨ Features

- **On-Device LLMs**: Powered by Transformers.js, running models like **Gemma 3 270M** and **Llama 3.2 1B** directly in your browser. No API keys required for inference.
- **Identity-Centric Architecture**: Create, save, and manage multiple bot identities. Each bot has its own unique keys, profile, and personality.
- **Dual-Layer System Prompt**: Combines hidden operational rules with user-defined personas for stable, character-accurate roleplay.
- **AI Test Bench**: Built-in playground to test your bot's responses and tune sampling parameters in real-time.
- **Privacy First**: Your keys and conversations stay in your browser's local storage.
- **Nostr Integration**: Automated monitoring of target outboxes and context-aware replies.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

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

4. Build for production:
   ```bash
   npm run build
   ```

## 🛠️ Configuration

### Identity Management
Use the **Identities Manager** (Users icon) in the header to switch between bots or create new ones. You can choose between a "Random Waifu" preset or a fully "Custom Bot."

### AI Tuning
The **Persona** tab allows you to adjust:
- **System Prompt**: Define your bot's character and goals.
- **Sampling Parameters**: Fine-tune Temperature, Top-P, and Repetition Penalty for optimal response quality.

## 📜 License

MIT

---
*Built with React, TypeScript, Vite, and Hugging Face Transformers.js.*
