/**
 * The spoken reminder.
 *
 * `expo-speech` is reached through a guard rather than imported directly. On a
 * build compiled without its native half the JavaScript loads fine and the
 * failure — "Cannot find native module 'ExpoSpeech'" — is thrown from the
 * module's own initialisation, where the New Architecture does not let a
 * surrounding try/catch catch it. `requireOptionalNativeModule` answers the
 * question without throwing, so the require below only runs when it can succeed.
 *
 * On web that probe is the wrong question: it only ever resolves inside a DOM
 * WebView, while expo-speech's web build speaks through the browser's own
 * `speechSynthesis`. Asking the native module there reports every browser as
 * mute, so the browser itself is asked instead.
 *
 * Nothing about the reminder depends on this. The alarm tone, the sheet and the
 * OS notification behave identically whether or not a voice is available —
 * speech is an addition on top, for somebody who cannot comfortably read the
 * screen.
 */

import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

import { translate, type Language } from "../i18n";
import type { Medicine } from "../types";

type SpeechModule = typeof import("expo-speech");

let cached: SpeechModule | null | undefined;

function speech(): SpeechModule | null {
  if (cached === undefined) {
    cached = null;
    const usable =
      Platform.OS === "web"
        ? typeof window !== "undefined" && "speechSynthesis" in window
        : requireOptionalNativeModule("ExpoSpeech") != null;
    if (usable) {
      try {
        cached = require("expo-speech") as SpeechModule;
      } catch {
        cached = null;
      }
    }
  }
  return cached;
}

export function speechAvailable(): boolean {
  return speech() !== null;
}

/** How long to wait for the engine's voice list before giving up on it. */
const VOICE_LOOKUP_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** The BCP-47 tag handed to the engine. */
export function voiceFor(language: Language): string {
  return language === "ne" ? "ne-NP" : "en-US";
}

/**
 * Whether the phone actually has a voice for this language installed.
 *
 * Android ships English everywhere and Nepali almost nowhere, and an engine
 * asked for a language it does not have will either read Devanagari in an
 * English voice or say nothing at all. Neither is a failure worth crashing
 * over, but the user should be told rather than left wondering why the phone
 * is silent — Settings uses this to say so.
 */
export async function hasVoiceFor(language: Language): Promise<boolean> {
  const S = speech();
  if (!S) return false;
  try {
    // A browser that never finishes loading its voice list leaves the promise
    // below pending forever, so the wait is bounded. A timeout is answered with
    // "yes" on purpose: the voice may well work, and warning that the language
    // is missing on the strength of a slow lookup would be a guess.
    const voices = await withTimeout(S.getAvailableVoicesAsync(), VOICE_LOOKUP_MS);
    if (!voices) return true;
    const wanted = language === "ne" ? "ne" : "en";
    // Tags come back as "ne-NP", "ne_NP" or bare "ne" depending on the engine.
    return voices.some((v) => (v.language || "").toLowerCase().replace("_", "-").startsWith(wanted));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// What it says
// ---------------------------------------------------------------------------

/** One to ten in Nepali. Beyond that a dose is a typing mistake, not a dose. */
const NEPALI_COUNT = [
  "शून्य",
  "एक",
  "दुई",
  "तीन",
  "चार",
  "पाँच",
  "छ",
  "सात",
  "आठ",
  "नौ",
  "दश",
];

/**
 * The dosage, as something a person would say out loud.
 *
 * Two problems with reading the stored dosage verbatim. It carries the strength
 * in brackets — "1 tablet (500 mg)" — which the medicine name has usually
 * already said; and in Nepali the count belongs in Nepali, so "1 tablet" should
 * be heard as "एक वटा", not as an English word in a Devanagari sentence.
 *
 * Anything this cannot confidently rewrite is spoken as written. Saying the
 * dose slightly awkwardly is fine; saying the wrong dose is not, so nothing
 * here ever changes a number or drops a unit it does not recognise.
 */
export function spokenDosage(dosage: string, language: Language): string {
  const plain = dosage.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (!plain) return "";
  if (language !== "ne") return plain;

  const match = plain.match(/^(\d+)\s*(.*)$/);
  if (!match) return plain;

  const count = Number(match[1]);
  const unit = match[2].toLowerCase();
  const spelled = count >= 0 && count < NEPALI_COUNT.length ? NEPALI_COUNT[count] : match[1];

  if (/^(tablet|tablets|pill|pills|capsule|capsules|tab|caps?)\b/.test(unit)) {
    return `${spelled} वटा`;
  }
  if (/^(drop|drops)\b/.test(unit)) return `${spelled} थोपा`;
  if (/^(spoon|spoons|tsp|teaspoon|teaspoons)\b/.test(unit)) return `${spelled} चम्चा`;
  if (/^(ml|milliliter|millilitre)/.test(unit)) return `${match[1]} मिलिलिटर`;
  return plain;
}

/**
 * The sentence the phone says when a dose is due.
 *
 * Two short sentences rather than a list: the first says something is due, the
 * second says what to do about it. That order matters when the first few words
 * are missed, which they usually are — the reminder still lands as "it is time
 * for your medicine", and repeating it (see `startSpeaking`) fills in the rest.
 *
 *   ne  "औषधि खाने समय भयो। कृपया Paracetamol एक वटा खानुहोस्।"
 *   en  "It is time for your medicine. Please take Paracetamol, 1 tablet."
 *
 * The medicine's name is never translated — it is what is printed on the box,
 * and that is what the person has in their hand.
 */
export function doseSentence(medicine: Medicine, language: Language): string {
  const opening = translate(language, "voice.timeForMedicine");
  const name = medicine.name.trim();
  if (!name) return `${opening} ${translate(language, "voice.pleaseTakeYours")}`;

  const dose = spokenDosage(medicine.dosage, language);
  const instruction = dose
    ? translate(language, "voice.pleaseTakeDose", { medicine: name, dose })
    : translate(language, "voice.pleaseTake", { medicine: name });
  return `${opening} ${instruction}`;
}

// ---------------------------------------------------------------------------
// Saying it, over and over, until the dose is answered
// ---------------------------------------------------------------------------

/** Silence between repeats. Long enough to act on, short enough to still nag. */
const REPEAT_GAP_MS = 5000;

/**
 * Slower than the engine's default. The people this is for are not in a hurry,
 * and a medicine name rushed is worse than no voice at all.
 */
const RATE = 0.75;

interface Loop {
  text: string;
  language: Language;
  timer: ReturnType<typeof setTimeout> | null;
  onSpeakingChange?: (speaking: boolean) => void;
}

let loop: Loop | null = null;
// Bumped every time a loop starts or stops, so a callback arriving late from a
// previous utterance cannot restart a reminder that has already been answered.
let generation = 0;

function sayOnce(mine: number) {
  const S = speech();
  const current = loop;
  if (!S || !current || mine !== generation) return;

  current.onSpeakingChange?.(true);
  try {
    S.speak(current.text, {
      language: voiceFor(current.language),
      rate: RATE,
      pitch: 1.0,
      volume: 1.0,
      onDone: () => {
        if (mine !== generation) return;
        loop?.onSpeakingChange?.(false);
        // Scheduled from onDone rather than on a fixed interval, so a slow
        // engine or a long medicine name can never have two readings overlap.
        if (loop) {
          loop.timer = setTimeout(() => sayOnce(mine), REPEAT_GAP_MS);
        }
      },
      onStopped: () => {
        if (mine !== generation) return;
        loop?.onSpeakingChange?.(false);
      },
      onError: () => {
        if (mine !== generation) return;
        // The engine cannot say this. Stop rather than retry every few seconds
        // forever — the alarm tone and the screen still carry the reminder.
        stopSpeaking();
      },
    });
  } catch {
    stopSpeaking();
  }
}

/**
 * Starts saying `text` and keeps saying it until `stopSpeaking` is called.
 *
 * Unbounded on purpose, and deliberately the same contract as the alarm tone
 * that plays beside it: a dose reminder stops when the dose is answered, not
 * when the phone decides it has asked enough times.
 *
 * `onSpeakingChange` fires around each reading, so the caller can duck the
 * alarm tone while the voice is talking over it.
 */
export function startSpeaking(
  text: string,
  language: Language,
  onSpeakingChange?: (speaking: boolean) => void
) {
  const S = speech();
  if (!S || !text.trim()) return;
  stopSpeaking();
  generation += 1;
  loop = { text, language, timer: null, onSpeakingChange };
  sayOnce(generation);
}

/** Stops the voice and cancels any repeat still pending. */
export function stopSpeaking() {
  const current = loop;
  generation += 1;
  loop = null;
  if (current?.timer) clearTimeout(current.timer);
  current?.onSpeakingChange?.(false);

  const S = speech();
  if (!S) return;
  try {
    S.stop();
  } catch {
    /* nothing was speaking */
  }
}

/** True while a reminder is being read out, or waiting to be read again. */
export function isSpeakingReminder(): boolean {
  return loop !== null;
}
