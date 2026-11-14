import type { SupportedLanguage } from '../types';
import { getCachedAudio, saveCachedAudio } from './offlineCache';

const SPEECH_LOCALE_MAP: Record<SupportedLanguage, string[]> = {
  en: ['en-IN', 'en-GB', 'en-US'],
  hi: ['hi-IN', 'en-IN'],
  as: ['as-IN', 'bn-IN', 'hi-IN'],
  bn: ['bn-IN', 'bn-BD', 'hi-IN'],
};

class MediSathiAudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private isCancelled = false;
  private listeners = new Set<(playingKey: string | null) => void>();
  private currentKey: string | null = null;

  subscribe(fn: (playingKey: string | null) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private setPlayingKey(key: string | null) {
    this.currentKey = key;
    this.listeners.forEach((fn) => fn(key));
  }

  getPlayingKey(): string | null {
    return this.currentKey;
  }

  stop(): void {
    this.isCancelled = true;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.setPlayingKey(null);
  }

  private playBase64Wav(base64: string): Promise<void> {
    return new Promise((resolve) => {
      const audio = new Audio(`data:audio/wav;base64,${base64}`);
      this.currentAudio = audio;
      audio.onended = () => {
        this.currentAudio = null;
        resolve();
      };
      audio.onerror = () => {
        this.currentAudio = null;
        resolve();
      };
      audio.play().catch(() => {
        this.currentAudio = null;
        resolve();
      });
    });
  }

  private speakViaWebSpeech(text: string, language: SupportedLanguage): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferred = SPEECH_LOCALE_MAP[language];

      for (const locale of preferred) {
        const match = voices.find((v) =>
          v.lang.toLowerCase().startsWith(locale.toLowerCase().slice(0, 2))
        );
        if (match) {
          utterance.voice = match;
          utterance.lang = match.lang;
          break;
        }
      }
      if (!utterance.lang) {
        utterance.lang = preferred[0];
      }
      utterance.rate = 0.92;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }

  async playText(key: string, text: string, language: SupportedLanguage): Promise<void> {
    if (this.currentKey === key) {
      this.stop();
      return;
    }

    this.stop();
    this.isCancelled = false;
    this.setPlayingKey(key);

    await this.playSingleInternal(text, language);

    if (!this.isCancelled && this.currentKey === key) {
      this.setPlayingKey(null);
    }
  }

  async playSequence(
    key: string,
    items: Array<{ text: string; language: SupportedLanguage }>
  ): Promise<void> {
    if (this.currentKey === key) {
      this.stop();
      return;
    }

    this.stop();
    this.isCancelled = false;
    this.setPlayingKey(key);

    for (const item of items) {
      if (this.isCancelled) break;
      await this.playSingleInternal(item.text, item.language);
    }

    if (!this.isCancelled && this.currentKey === key) {
      this.setPlayingKey(null);
    }
  }

  private async playSingleInternal(
    text: string,
    language: SupportedLanguage
  ): Promise<void> {
    if (!text.trim() || this.isCancelled) return;

    const cached = getCachedAudio(language, text);
    if (cached) {
      await this.playBase64Wav(cached);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const resp = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language }),
        });
        if (resp.ok) {
          const data = (await resp.json()) as {
            audioBase64?: string | null;
            fallback?: string | null;
          };
          if (this.isCancelled) return;
          if (data.audioBase64) {
            saveCachedAudio(language, text, data.audioBase64);
            await this.playBase64Wav(data.audioBase64);
            return;
          }
        }
      } catch {
        // Fall through to Web Speech API
      }
    }

    if (!this.isCancelled) {
      await this.speakViaWebSpeech(text, language);
    }
  }
}

export const audioManager = new MediSathiAudioManager();
