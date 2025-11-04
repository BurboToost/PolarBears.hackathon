# Medical Chatbot (English & Bangla)

This is a minimal bilingual chatbot scaffold (English and Bangla) you can embed into a medical website. It provides general medical information and safety disclaimers — it's not a replacement for professional medical advice.

Features
- Simple web UI (static files in `public/`) with language toggle
- Node/Express backend (`server.js`) exposing `POST /chat`
- If `OPENAI_API_KEY` is set, the server will call OpenAI's Chat Completions. If not, the server falls back to safe canned responses.

Quick start

1. Install Node (>=14) and npm.
2. From project root:

```bash
npm install
```

3. (Optional) Set your OpenAI API key as an environment variable to enable real AI responses:

```bash
export OPENAI_API_KEY="sk-..."
```

4. Start the server:

```bash
npm start
```

5. Open your browser to http://localhost:3000

API
- POST /chat
  - Request JSON: { message: string, language: 'en' | 'bn' }
  - Response JSON: { reply: string } or { error: '...' }

Example curl (fallback mode if no OPENAI_API_KEY):

```bash
curl -s -X POST http://localhost:3000/chat -H "Content-Type: application/json" -d '{"message":"I have a fever and headache","language":"en"}' | jq
```

Notes & Safety
- This project intentionally includes a clear disclaimer in both UI and server output: the bot is not a doctor and cannot issue diagnoses or prescriptions.
- If you enable OpenAI usage, ensure you follow privacy/security rules for personal health data and display clear consent.

Next steps / improvements
- Add logging, rate-limiting, and input sanitization for production.
- Add session history and context management on the server if you want multi-turn medical conversations.
- Add stricter medical content safety filters before returning any clinical recommendations.

Voice mode
- The web UI includes a microphone button to use voice input (speech-to-text) and a "Voice replies" checkbox to enable speech synthesis for the bot's replies.
- Voice input and output use the browser's Web Speech APIs. This works best in modern Chromium-based browsers (Chrome, Edge) and may be limited or unavailable on some browsers (Safari, Firefox). For Bangla the results depend on the browser/OS support for Bengali speech recognition and synthesis.

