/**
 * Global notification sound (public/Sound/Notification.mp3).
 * Safe under browser autoplay rules — failures are ignored silently.
 */

import { NOTIFICATION_SOUND } from "@/lib/public-assets";

const SOUND_SRC = NOTIFICATION_SOUND;
const MUTE_KEY = "nexusdesk-notification-sound-muted";

let audio: HTMLAudioElement | null = null;
let unlocked = false;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio(SOUND_SRC);
    audio.preload = "auto";
    audio.volume = 0.75;
  }
  return audio;
}

/** Call once after a user gesture so browsers allow later autoplay. */
export function unlockNotificationSound() {
  if (typeof window === "undefined" || unlocked) return;
  const a = getAudio();
  if (!a) return;
  const prev = a.volume;
  a.volume = 0;
  a
    .play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.volume = prev;
      unlocked = true;
    })
    .catch(() => {
      a.volume = prev;
    });
}

export function isNotificationSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setNotificationSoundMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Play notification chime (no-op if muted / unavailable). */
export function playNotificationSound() {
  if (typeof window === "undefined") return;
  if (isNotificationSoundMuted()) return;
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => {
      /* autoplay blocked until unlock */
    });
  } catch {
    /* ignore */
  }
}
