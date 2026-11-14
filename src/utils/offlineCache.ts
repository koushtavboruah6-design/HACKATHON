import type { BootstrapPayload, SupportedLanguage } from '../types';

const STATE_CACHE_KEY = 'medisathi.last_bootstrap.v1';
const AUDIO_CACHE_KEY = 'medisathi.audio_cache.v1';
const ONBOARDED_KEY = 'medisathi.onboarded.v1';

export function saveBootstrapCache(payload: BootstrapPayload): void {
  try {
    localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota errors on low-end devices
  }
}

export function loadBootstrapCache(): BootstrapPayload | null {
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BootstrapPayload;
  } catch {
    return null;
  }
}

function makeAudioKey(language: SupportedLanguage, text: string): string {
  // Simple deterministic short key
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return `${language}:${hash}:${text.length}`;
}

export function getCachedAudio(language: SupportedLanguage, text: string): string | null {
  try {
    const raw = localStorage.getItem(AUDIO_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[makeAudioKey(language, text)] ?? null;
  } catch {
    return null;
  }
}

export function saveCachedAudio(
  language: SupportedLanguage,
  text: string,
  base64Wav: string
): void {
  try {
    const raw = localStorage.getItem(AUDIO_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    // Keep cache compact (max 10 clips) for budget Android storage
    const keys = Object.keys(map);
    if (keys.length >= 10) {
      delete map[keys[0]];
    }
    map[makeAudioKey(language, text)] = base64Wav;
    localStorage.setItem(AUDIO_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, 'true');
  } catch {
    // ignore
  }
}
