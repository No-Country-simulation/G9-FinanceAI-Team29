const MALE_VOICE_HINTS = [
  "male",
  "hombre",
  "jorge",
  "diego",
  "carlos",
  "pablo",
  "juan",
  "miguel",
  "sergio",
  "alvaro",
];

const FEMALE_VOICE_HINTS = ["female", "mujer", "monica", "paulina", "helena", "lucia", "elena", "sabina"];

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      resolve(voices);
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    };
  });
}

export function pickMaleSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const esVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith("es"));
  const pool = esVoices.length > 0 ? esVoices : voices;

  const explicitlyMale = pool.find((v) => MALE_VOICE_HINTS.some((hint) => v.name.toLowerCase().includes(hint)));
  if (explicitlyMale) return explicitlyMale;

  const notFemale = pool.find((v) => !FEMALE_VOICE_HINTS.some((hint) => v.name.toLowerCase().includes(hint)));
  if (notFemale) return notFemale;

  return pool[0] ?? null;
}

function limpiarTextoParaVoz(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/^\s*[*-]\s+/gm, "")
    .replace(/\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/g, "$1 dólares")
    .replace(/\n+/g, ". ")
    .trim();
}

export async function speakText(text: string): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const voices = cachedVoices.length > 0 ? cachedVoices : await loadVoices();
  const voice = pickMaleSpanishVoice(voices);

  const utterance = new SpeechSynthesisUtterance(limpiarTextoParaVoz(text));
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "es-ES";
  }
  utterance.pitch = 0.85;
  utterance.rate = 1;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
