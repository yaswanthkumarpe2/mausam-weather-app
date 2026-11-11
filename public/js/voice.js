// Member 1: reads the daily briefing aloud with the browser's built-in speech voices.

export const canSpeak = () => 'speechSynthesis' in globalThis;

export function speak(text, lang, onEnd) {
  speechSynthesis.cancel();
  const code = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  utterance.lang = code;
  utterance.voice = voices.find((voice) => voice.lang === code)
    ?? voices.find((voice) => voice.lang.startsWith(lang))
    ?? null;
  utterance.rate = 0.98;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  speechSynthesis.speak(utterance);
}

export const stopSpeaking = () => speechSynthesis.cancel();
