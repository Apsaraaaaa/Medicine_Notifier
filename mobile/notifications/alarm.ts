// Alarm sound engine, backed by expo-audio.
//
// The tone is a bundled asset rather than a synthesised one: React Native has
// no Web Audio API, and a short looping WAV is what a device can keep playing
// while the reminder sheet waits for an answer.
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import type { EventSubscription } from "expo-modules-core";

const ALARM = require("../assets/sounds/alarm.wav");

let player: AudioPlayer | null = null;
let statusSub: EventSubscription | null = null;
// The volume the alarm was started at, so ducking can restore it exactly
// rather than guessing at the user's setting.
let baseVolume = 0.6;
let ducked = false;

function clamp(volume: number) {
  return Math.max(0.05, Math.min(1, volume));
}

/**
 * How far the tone drops while the spoken reminder is talking over it.
 *
 * Not silence: the alarm is what carries across a room, and cutting it
 * entirely for every sentence would make the reminder come and go. A quarter
 * is enough for the words to sit on top of it.
 */
const DUCK = 0.25;

/**
 * Lowers the alarm while the voice speaks, and restores it afterwards.
 *
 * A no-op when no alarm is playing, so the voice reminder works the same
 * whether or not the alarm sound is switched on.
 */
export function duckAlarm(quiet: boolean) {
  ducked = quiet;
  if (!player) return;
  try {
    player.volume = clamp(quiet ? baseVolume * DUCK : baseVolume);
  } catch {
    /* player already released */
  }
}

export async function startAlarm(volume = 0.6) {
  await stopAlarm();
  try {
    // Play through the loudspeaker even when the phone is on silent — a
    // missed dose is exactly the case a silent switch shouldn't win.
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "doNotMix",
    });

    const created = createAudioPlayer(ALARM);
    player = created;
    created.loop = true;
    baseVolume = volume;
    // Starting while the voice is mid-sentence must not undo the ducking.
    created.volume = clamp(ducked ? volume * DUCK : volume);

    // play() before the asset has loaded is a no-op, and createAudioPlayer
    // loads asynchronously — so ask once now, and again the moment the player
    // reports itself loaded. Without this second call the alarm stays silent.
    created.play();
    statusSub = created.addListener("playbackStatusUpdate", (status: AudioStatus) => {
      if (player !== created) return; // a newer alarm has taken over
      if (status.isLoaded && !status.playing) created.play();
    });
  } catch {
    // No audio device, or the asset failed to load: the reminder sheet and
    // the OS notification still carry the message.
    player = null;
  }
}

export async function stopAlarm() {
  const current = player;
  player = null;
  ducked = false;
  statusSub?.remove();
  statusSub = null;
  if (!current) return;
  try {
    current.pause();
    current.remove();
  } catch {
    /* already released */
  }
}

export function isAlarmPlaying(): boolean {
  return player !== null;
}
