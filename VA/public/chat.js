(() => {
  const chatEl = document.getElementById('chat');
  const form = document.getElementById('chat-form');
  const textarea = document.getElementById('message');
  const langEnBtn = document.getElementById('lang-en');
  const langBnBtn = document.getElementById('lang-bn');
  const micBtn = document.getElementById('mic-btn');
  const voiceOutputCheckbox = document.getElementById('voice-output');

  let language = 'bn';
  let recognizing = false;
  let recognition = null;

  function setActiveLang(lang) {
    language = lang;
    langEnBtn.classList.toggle('active', lang === 'en');
    langBnBtn.classList.toggle('active', lang === 'bn');
  }

  langEnBtn.addEventListener('click', () => setActiveLang('en'));
  langBnBtn.addEventListener('click', () => setActiveLang('bn'));

  /**
   * Append a message to the chat.
   * @param {string} text - message text
   * @param {'user'|'assistant'} who - sender
   * @param {string} [msgLang] - language of this message ('en'|'bn'), defaults to current language
   */
  function appendMessage(text, who, msgLang) {
    const langForMessage = msgLang || language;
    const msg = document.createElement('div');
    msg.className = 'message ' + who;

    if (who === 'assistant') {
      // create a container so we can attach a reply/play button
      const wrapper = document.createElement('div');
      wrapper.className = 'assistant-wrapper';

      const textEl = document.createElement('div');
      textEl.className = 'assistant-text';
      textEl.textContent = text;

      const controls = document.createElement('div');
      controls.className = 'assistant-controls';

      const replay = document.createElement('button');
      replay.type = 'button';
      replay.className = 'replay';
      replay.title = langForMessage === 'bn' ? 'পুনরায় চালান' : 'Replay';
      replay.innerHTML = '🔊';
      replay.addEventListener('click', (ev) => {
        ev.stopPropagation();
        // Play the exact message in the message language
        if (!('speechSynthesis' in window)) {
          // show a small inline notice
          appendMessage(langForMessage === 'bn' ? 'এই ব্রাউজারে ভয়েস সমর্থিত নেই।' : 'Voice not supported in this browser.', 'assistant', langForMessage);
          return;
        }
        try { speak(text, langForMessage); } catch (e) { console.warn('replay failed', e); }
      });

      controls.appendChild(replay);
      wrapper.appendChild(textEl);
      wrapper.appendChild(controls);
      msg.appendChild(wrapper);
    } else {
      msg.textContent = text;
    }

    chatEl.appendChild(msg);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  async function sendMessage(message) {
    appendMessage(message, 'user');
    appendMessage('...', 'assistant');
    try {
      const resp = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, language })
      });
      const data = await resp.json();
      // remove the last assistant placeholder
      const assistants = document.querySelectorAll('.message.assistant');
      if (assistants.length) assistants[assistants.length - 1].remove();
      if (data && data.reply) {
        // append assistant message and pass the message language so replay uses correct locale
        appendMessage(data.reply, 'assistant', language);
        if (voiceOutputCheckbox && voiceOutputCheckbox.checked) {
          try { await speak(data.reply, language); } catch (e) { console.warn('speak error', e); }
        }
      } else if (data && data.error) {
        appendMessage('Error: ' + data.error, 'assistant');
      } else {
        appendMessage('No reply', 'assistant');
      }
    } catch (e) {
      console.error(e);
      const assistants = document.querySelectorAll('.message.assistant');
      if (assistants.length) assistants[assistants.length - 1].remove();
      appendMessage('Network error', 'assistant');
    }
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = textarea.value.trim();
    if (!text) return;
    textarea.value = '';
    sendMessage(text);
  });

  // --- Speech recognition (voice input) ---
  function isSpeechRecognitionSupported() {
    return ('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window);
  }

  function createRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = language === 'bn' ? 'bn-BD' : 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (ev) => {
      const text = ev.results[0][0].transcript;
      textarea.value = text;
      // auto-submit
      sendMessage(text);
    };
    r.onerror = (ev) => {
      console.error('Speech recognition error', ev);
      stopRecognition();
      appendMessage(language === 'bn' ? 'ভয়েস শনাক্তকরণ সমস্যা' : 'Voice recognition error', 'assistant');
    };
    r.onend = () => {
      recognizing = false;
      updateMicUI();
    };
    return r;
  }

  function startRecognition() {
    if (!isSpeechRecognitionSupported()) {
      appendMessage(language === 'bn' ? 'এই ব্রাউজারটি ভয়েস ইনপুট সমর্থন করে না।' : 'This browser does not support voice input.', 'assistant');
      return;
    }
    if (!recognition) recognition = createRecognition();
    if (!recognition) return;
    recognizing = true;
    recognition.lang = language === 'bn' ? 'bn-BD' : 'en-US';
    try {
      recognition.start();
    } catch (e) {
      console.warn('recognition start failed', e);
    }
    updateMicUI();
  }

  function stopRecognition() {
    if (recognition && recognizing) {
      try { recognition.stop(); } catch (e) {}
    }
    recognizing = false;
    updateMicUI();
  }

  function toggleRecognition() {
    if (recognizing) stopRecognition(); else startRecognition();
  }

  function updateMicUI() {
    if (!micBtn) return;
    micBtn.classList.toggle('listening', recognizing);
    if (recognizing) {
      micBtn.textContent = language === 'bn' ? '🔴 শোনা হচ্ছে...' : '🔴 Listening...';
    } else {
      micBtn.textContent = language === 'bn' ? '🎤 ভয়েস শুরু করুন' : '🎤 Start Voice';
    }
  }

  if (micBtn) {
    micBtn.addEventListener('click', () => toggleRecognition());
  }

  // --- Speech synthesis (voice output) ---
  // Ensure voices are loaded (some browsers load them asynchronously)
  function ensureVoicesLoaded(timeout = 1500) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) return resolve(false);
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length) return resolve(true);
      let resolved = false;
      function onVoicesChanged() {
        if (resolved) return;
        resolved = true;
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(true);
      }
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      // fallback timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
          resolve(!!(window.speechSynthesis.getVoices() || []).length);
        }
      }, timeout);
    });
  }

  // Speak text and return a Promise that resolves when finished (or rejects on error)
  async function speak(text, lang) {
    if (!('speechSynthesis' in window)) return Promise.resolve();
    try {
      await ensureVoicesLoaded();
    } catch (e) {
      // ignore
    }
    return new Promise((resolve) => {
      try {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length) {
          const pref = voices.find(v => v.lang && v.lang.startsWith(lang === 'bn' ? 'bn' : 'en')) || voices.find(v => v.lang && v.lang.startsWith('en')) || voices[0];
          if (pref) utter.voice = pref;
        }
        // small tweaks for clarity
        utter.rate = 0.95;
        utter.pitch = 1.0;
        utter.volume = 1.0;
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        // Some browsers require a user gesture before audio plays. Try resume() first.
        try { window.speechSynthesis.resume(); } catch (e) {}
        // cancel any previous spoken text to avoid overlaps
        try { window.speechSynthesis.cancel(); } catch (e) {}
        window.speechSynthesis.speak(utter);
      } catch (e) {
        console.warn('speak failed', e);
        resolve();
      }
    });
  }

  // update recognition language when user toggles language
  const observeLangButtons = [langEnBtn, langBnBtn];
  observeLangButtons.forEach(b => b.addEventListener('click', () => {
    // if recognition is active, restart it with new lang
    if (recognizing) {
      stopRecognition();
      setTimeout(() => startRecognition(), 250);
    }
  }));

  // starter message (also speak a demo reply if voice output is enabled)
  const starterText = language === 'bn' ? 'কিভাবে সাহায্য করতে পারি? আপনার লক্ষণ লিখুন অথবা ভয়েস দিন।' : 'Hello — how can I help? Describe your symptoms or use voice input.';
  appendMessage(starterText, 'assistant');
  // Demo voice response on load if voice output is enabled
  function speakDemoOnLoad() {
    try {
      if (voiceOutputCheckbox && voiceOutputCheckbox.checked && 'speechSynthesis' in window) {
        // Wait a short moment to allow voices to load in some browsers
        const speakNow = () => speak(starterText, language);
        if ((window.speechSynthesis && window.speechSynthesis.getVoices && window.speechSynthesis.getVoices().length > 0)) {
          speakNow();
        } else {
          // voices may load asynchronously
          window.speechSynthesis.addEventListener('voiceschanged', () => {
            speakNow();
          });
          // fallback timeout
          setTimeout(speakNow, 800);
        }
      }
    } catch (e) {
      console.warn('Demo speak failed', e);
    }
  }

  // call demo speak after a short delay so UI finishes rendering
  setTimeout(speakDemoOnLoad, 350);
})();
