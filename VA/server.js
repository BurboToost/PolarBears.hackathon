const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

const OPENAI_KEY = process.env.OPENAI_API_KEY || null;
let OpenAIClient = null;
if (OPENAI_KEY) {
  try {
    const OpenAI = require('openai');
    OpenAIClient = new OpenAI({ apiKey: OPENAI_KEY });
    console.log('OpenAI client configured.');
  } catch (e) {
    console.warn('openai package not available or failed to initialize:', e.message);
    OpenAIClient = null;
  }
} else {
  console.log('No OPENAI_API_KEY found — server will use fallback canned responses.');
}

function simpleCannedResponse(message, language) {
  const m = (message || '').toLowerCase();
  const contains = (arr) => arr.some(w => m.includes(w));

  if (language === 'bn') {
    if (contains(['জ্বর', 'জ্বর আছে', 'জ্বরটা'])) {
      return 'জ্বর থাকলে পর্যাপ্ত বিশ্রাম ও তরল পান করুন। তীব্র বা দীর্ঘস্থায়ী জ্বর হলে নিকটস্থ চিকিৎসকের পরামর্শ নিন। আমি ডাক্তর নই, তাই এটি একটি সাধারণ পরামর্শ।';
    }
    if (contains(['বিরক্তি', 'ব্যথা', 'পেইন', 'ব্যথা আছে'])) {
      return 'যে কোনো হঠাৎ তীব্র ব্যথা বা শ্বাসপ্রশ্বাসে সমস্যা হলে জরুরি চিকিৎসা নিন। লক্ষণগুলো বললে আমি আরও সাধারণ তথ্য দিতে পারি।';
    }
    return 'আমি সাধারণ স্বাস্থ্য তথ্য দিতে পারি, কিন্তু আমি ডাক্তার নই। দয়া করে স্পষ্ট লক্ষণ ও প্রয়োজনীয় তথ্য বলুন, এবং যদি জরুরি থাকে তাহলে নিকটস্থ চিকিৎসকের সঙ্গে যোগাযোগ করুন।';
  }

  // English fallback
  if (contains(['fever', 'temperature'])) {
    return 'If you have a fever, rest and stay hydrated. If fever is very high or persistent, please consult a doctor. I am not a doctor — this is general information.';
  }
  if (contains(['pain', 'ache', 'hurt'])) {
    return 'For acute or severe pain seek medical attention. Tell me more about the symptoms and duration and I can provide general information.';
  }
  return 'I can provide general medical information and guidance, but I am not a doctor. Please tell me your symptoms in more detail, or consult a healthcare professional for medical advice.';
}

app.post('/chat', async (req, res) => {
  try {
    const { message, language } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const lang = language === 'bn' ? 'bn' : 'en';

    // safety: limit message length
    if (message.length > 8000) {
      return res.status(413).json({ error: 'Message too long' });
    }

    const systemPromptEn = `You are a cautious, helpful medical assistant. Answer in plain language, be concise, and always include a clear safety/disclaimer that you are not a doctor and encourage consulting a healthcare professional for serious issues. Do not provide prescriptions or definitive diagnoses. Ask clarifying questions when symptoms are vague.`;
    const systemPromptBn = `আপনি একজন সাবধানী, সহায়ক মেডিকেল সহকারী। সাধারণ ভাষায় সংক্ষেপে উত্তর দিন। সর্বদা বলুন যে আপনি ডাক্তার নন এবং গুরুতর সন্দেহ থাকলে স্বাস্থ্যকেন্দ্রে যাওয়ার পরামর্শ দিন। কোনো ওষুধ বা চূড়ান্ত রোগনির্ণয়ের পরামর্শ দেবেন না। লক্ষণ অস্পষ্ট হলে স্পষ্ট করার প্রশ্ন করুন।`;

    if (OpenAIClient) {
      // Use OpenAI Chat Completions
      const messages = [
        { role: 'system', content: lang === 'bn' ? systemPromptBn : systemPromptEn },
        { role: 'user', content: message }
      ];

      try {
        const resp = await OpenAIClient.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages,
          temperature: 0.2,
          max_tokens: 700
        });

        const out = (resp && resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content) || '';
        return res.json({ reply: out });
      } catch (err) {
        console.error('OpenAI request failed:', err && err.message ? err.message : err);
        // fall back to canned
      }
    }

    // fallback canned response
    const reply = simpleCannedResponse(message, lang);
    return res.json({ reply });
  } catch (e) {
    console.error('Chat handler error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
