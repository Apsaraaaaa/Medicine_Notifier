import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";

import {
  DARK,
  LIGHT,
  PATIENT_SNOOZE_MINUTES,
  SNOOZE_MINUTES,
  STORAGE_KEYS,
  type Palette,
} from "../constants/theme";
import {
  localeFor,
  translatorFor,
  type Language,
  type TranslationKey,
  type Translator,
} from "../i18n";
import { duckAlarm, startAlarm, stopAlarm } from "../notifications/alarm";
import {
  addReminderResponseListener,
  cancelAllReminders,
  presentCaregiverAlert,
  requestPermission,
  scheduleSnooze,
  syncScheduledReminders,
} from "../notifications/reminders";
import * as api from "../services/api";
import type {
  CaregiverAlert,
  HistoryEntry,
  HistoryStatus,
  Medicine,
  PatientLink,
  Settings,
  User,
} from "../types";
import { setDateLocale, todayISO } from "../utils/date";
import { getTodaySlots, type DoseSlot } from "../utils/schedule";
import {
  doseSentence,
  hasVoiceFor,
  speechAvailable,
  startSpeaking,
  stopSpeaking,
} from "../utils/speech";
import { storage } from "../utils/storage";

export interface ActiveReminder {
  key: string;
  medicine: Medicine;
  time: string;
  date: string;
}

interface AppContextValue {
  ready: boolean;
  user: User | null;
  token: string | null;
  medicines: Medicine[];
  history: HistoryEntry[];
  settings: Settings;
  activeReminder: ActiveReminder | null;
  authLoading: boolean;
  refreshing: boolean;
  /** Reminders the phone is currently holding, after the last sync. */
  remindersScheduled: number;
  // presentation
  /** True when the simplified, large-type Patient Mode face is on. */
  patientMode: boolean;
  // language
  language: Language;
  /** Translates a key in the chosen language. Every screen reads its text from here. */
  t: Translator;
  setLanguage: (language: Language) => void;
  // auth
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (oldPw: string, newPw: string) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  // data
  refresh: () => Promise<void>;
  addMedicine: (data: Omit<Medicine, "id">) => Promise<void>;
  editMedicine: (id: string, data: Omit<Medicine, "id">) => Promise<void>;
  removeMedicine: (id: string) => Promise<void>;
  // caregiving — the people this user watches over, and what they've been told
  patients: PatientLink[];
  alerts: CaregiverAlert[];
  unreadAlerts: number;
  refreshCaregiving: () => Promise<void>;
  markAlertRead: (id: string) => Promise<void>;
  markAllAlertsRead: () => Promise<void>;
  // reminders
  respondReminder: (status: HistoryStatus, note?: string) => void;
  snoozeReminder: () => void;
  triggerReminder: (medicine: Medicine, time: string) => void;
  /** Says the active reminder again, from the top. */
  speakReminder: () => void;
  /**
   * How long a snooze lasts right now — shorter in Patient Mode. Exposed so
   * the button can say the number it is actually going to wait.
   */
  snoozeMinutes: number;
  /**
   * Slot keys (see utils/schedule.slotKey) currently pushed back by a snooze.
   * The schedule renders these as "snoozed" rather than "missed".
   */
  snoozedSlots: ReadonlySet<string>;
  // settings
  updateSettings: (patch: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
  notifications: true,
  alarmSound: true,
  volume: 0.6,
  darkMode: false,
  language: "en",
  // Off by default: the full interface is what an existing user already has,
  // and Patient Mode is something you choose, not something you wake up in.
  patientMode: false,
  // Likewise off: a phone that starts talking unasked is alarming.
  voiceReminder: false,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [activeReminder, setActiveReminder] = useState<ActiveReminder | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [remindersScheduled, setRemindersScheduled] = useState(0);
  const [patients, setPatients] = useState<PatientLink[]>([]);
  const [alerts, setAlerts] = useState<CaregiverAlert[]>([]);
  // The snooze map below is a ref, because the ticker reads it every second
  // and re-rendering for that would be wasteful. But the *schedule* has to
  // show a snoozed dose as snoozed, and a ref cannot trigger that render — so
  // the same keys are mirrored into state, which only changes when a dose is
  // actually snoozed or resolved.
  const [snoozedSlots, setSnoozedSlots] = useState<ReadonlySet<string>>(new Set());

  const firedRef = useRef<Set<string>>(new Set());
  const snoozeRef = useRef<Map<string, number>>(new Map()); // key -> timestamp to fire
  const medicinesRef = useRef<Medicine[]>([]);
  medicinesRef.current = medicines;
  // Alert ids already announced on this phone, so an alert that stays unread
  // isn't re-announced on every sync.
  const announcedRef = useRef<Set<string>>(new Set());
  /**
   * The current settings, readable synchronously.
   *
   * `updateSettings` needs the value it is patching *and* the value it
   * produced, in the same tick, so it can save the result itself rather than
   * leaving that to an effect. See the note on persistence below.
   */
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const language = settings.language;
  const t = useMemo(() => translatorFor(language), [language]);

  // Dates are formatted by helpers that read a module-level locale rather than
  // taking one as an argument (see utils/date). Assigning it here, during the
  // render that follows a language change, is what makes the very first paint
  // after the switch already show Nepali month and weekday names.
  setDateLocale(localeFor(language));

  // ---- bootstrap ----
  useEffect(() => {
    (async () => {
      // `read`, not `get`: a failed read must not be mistaken for "nothing
      // saved yet". If it fails, the app runs on the defaults for this session
      // and never persists them, so the real settings survive to the next
      // launch instead of being silently replaced.
      const settingsRead = await storage.read<Partial<Settings>>(STORAGE_KEYS.settings);
      const stored = settingsRead.value ?? {};
      if (settingsRead.ok) {
        const loaded = { ...defaultSettings, ...stored };
        settingsRef.current = loaded;
        setSettings(loaded);
      }
      announcedRef.current = new Set(
        await storage.get<string[]>(STORAGE_KEYS.seenAlerts, [])
      );
      try {
        // Checks the stored token with the server and drops it if it is no
        // longer valid, so a stale session can't leave the app "signed in"
        // with every request failing.
        const session = await api.restoreSession();
        if (session) {
          setToken(session.token);
          setUser(session.user);
          // The account's language is the one the server composes alerts in.
          // The phone's stored choice wins for the UI, but a session restored
          // on a new device should still open in the language the user chose.
          if (session.user.language && !stored.language) {
            setSettings((s) => ({ ...s, language: session.user.language! }));
          }
          // A dead server or an expired session must not leave the app stuck
          // on the splash screen, so bootstrap always finishes and the screens
          // fall back to their empty states.
          setMedicines(await api.getMedicines());
          setHistory(await api.getHistory());
        }
      } catch {
        // Keep the stored session: being briefly offline shouldn't sign you out.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Settings are saved by `updateSettings` and `setLanguage`, at the moment the
  // user changes one — not by an effect watching `settings`.
  //
  // That effect looked equivalent and was not. It fires on every render where
  // `settings` differs from the last write, including the first render after
  // the provider remounts — and at that point `settings` is still the
  // *defaults*, because the stored values are read asynchronously and have not
  // arrived yet. A remount therefore saved the defaults over whatever the user
  // had actually chosen. Gating it on a "loaded" flag does not help: a remount
  // can preserve the flag while resetting the settings, which is exactly the
  // case that lost a language and a Patient Mode switch here.
  //
  // Writing only from the two functions that change a setting removes the
  // failure entirely: nothing that is not a deliberate change can ever write.

  const loadData = useCallback(async () => {
    setMedicines(await api.getMedicines());
    setHistory(await api.getHistory());
  }, []);

  /**
   * Whoever this user watches over, and what has been raised about them.
   *
   * Deliberately separate from `refresh`: most people are never a caregiver,
   * and the two calls should not make the home screen wait on each other.
   * Both failures are swallowed — being briefly offline is not worth an error
   * on a screen that isn't asking about caregiving.
   */
  const refreshCaregiving = useCallback(async () => {
    try {
      setPatients(await api.getPatients());
      setAlerts(await api.getAlerts());
    } catch {
      // Leave the last known state; the screens show it with a retry.
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await loadData();
      await refreshCaregiving();
    } catch {
      // Pull-to-refresh should never throw into the screen; the last data stands.
    } finally {
      setRefreshing(false);
    }
  }, [loadData, refreshCaregiving, token]);

  // ---- AUTH ----
  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setAuthLoading(true);
      try {
        const res = await api.register(name, email, password);
        setToken(res.token);
        setUser(res.user);
        await loadData();
        requestPermission();
      } finally {
        setAuthLoading(false);
      }
    },
    [loadData]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      setAuthLoading(true);
      try {
        const res = await api.login(email, password);
        setToken(res.token);
        setUser(res.user);
        await loadData();
        requestPermission();
      } finally {
        setAuthLoading(false);
      }
    },
    [loadData]
  );

  const logout = useCallback(async () => {
    await api.logout();
    await stopAlarm();
    stopSpeaking();
    await cancelAllReminders();
    firedRef.current.clear();
    snoozeRef.current.clear();
    setSnoozedSlots(new Set());
    setActiveReminder(null);
    setToken(null);
    setUser(null);
    setMedicines([]);
    setHistory([]);
    setPatients([]);
    setAlerts([]);
  }, []);

  const changePassword = useCallback(async (oldPw: string, newPw: string) => {
    await api.changePassword(oldPw, newPw);
  }, []);

  const updateProfile = useCallback(async (name: string) => {
    setUser(await api.updateProfile(name));
  }, []);

  // ---- MEDICINES ----
  const addMedicine = useCallback(async (data: Omit<Medicine, "id">) => {
    await api.createMedicine(data);
    setMedicines(await api.getMedicines());
  }, []);

  const editMedicine = useCallback(async (id: string, data: Omit<Medicine, "id">) => {
    await api.updateMedicine(id, data);
    setMedicines(await api.getMedicines());
  }, []);

  const removeMedicine = useCallback(async (id: string) => {
    await api.deleteMedicine(id);
    setMedicines(await api.getMedicines());
  }, []);

  // ---- CAREGIVER ALERTS ----
  const markAlertRead = useCallback(async (id: string) => {
    // Optimistic: the row greys out at once, and the next sync would correct
    // it anyway if the call failed.
    setAlerts((list) =>
      list.map((a) => (a.id === id ? { ...a, readAt: new Date().toISOString() } : a))
    );
    try {
      await api.markAlertRead(id);
      setPatients(await api.getPatients());
    } catch {
      setAlerts(await api.getAlerts().catch(() => alerts));
    }
  }, [alerts]);

  const markAllAlertsRead = useCallback(async () => {
    const now = new Date().toISOString();
    setAlerts((list) => list.map((a) => (a.readAt ? a : { ...a, readAt: now })));
    try {
      await api.markAllAlertsRead();
      setPatients(await api.getPatients());
    } catch {
      // The next sync restores the true state.
    }
  }, []);

  // ---- REMINDERS ----
  const triggerReminder = useCallback(
    (medicine: Medicine, time: string) => {
      const date = todayISO();
      const key = `${medicine.id}|${date}|${time}`;
      setActiveReminder({ key, medicine, time, date });
      if (settings.alarmSound) {
        startAlarm(settings.volume);
      }
      // The voice lives here, beside the alarm, rather than inside a reminder
      // screen: both are "a dose is due" behaviour, both must stop on the same
      // two answers, and putting them together is what guarantees they do.
      if (settings.voiceReminder) {
        startSpeaking(doseSentence(medicine, language), language, duckAlarm);
      }
    },
    [settings.alarmSound, settings.voiceReminder, settings.volume, language]
  );

  /**
   * Repeats the current reminder on demand — the "say it again" button.
   *
   * Restarts the loop rather than speaking once, so pressing it also resets the
   * gap before the next automatic repeat.
   */
  const speakReminder = useCallback(() => {
    if (!activeReminder) return;
    startSpeaking(doseSentence(activeReminder.medicine, language), language, duckAlarm);
  }, [activeReminder, language]);

  const record = useCallback(
    async (status: HistoryStatus, reminder: ActiveReminder, note?: string) => {
      const entry: Omit<HistoryEntry, "id"> = {
        medicineId: reminder.medicine.id,
        medicineName: reminder.medicine.name,
        dosage: reminder.medicine.dosage,
        time: reminder.time,
        date: reminder.date,
        status,
        recordedAt: new Date().toISOString(),
        ...(note?.trim() ? { note: note.trim() } : {}),
      };
      await api.addHistory(entry);
      setHistory(await api.getHistory());
    },
    []
  );

  const respondReminder = useCallback(
    (status: HistoryStatus, note?: string) => {
      stopAlarm();
      stopSpeaking();
      if (activeReminder) {
        const { key } = activeReminder;
        record(status, activeReminder, note);
        firedRef.current.add(key);
        snoozeRef.current.delete(key);
        setSnoozedSlots((prev) => {
          if (!prev.has(key)) return prev; // no render for the common case
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
      setActiveReminder(null);
    },
    [activeReminder, record]
  );

  /** 5 minutes in Patient Mode, 15 otherwise. */
  const snoozeMinutes = settings.patientMode ? PATIENT_SNOOZE_MINUTES : SNOOZE_MINUTES;

  const snoozeReminder = useCallback(() => {
    stopAlarm();
    stopSpeaking();
    if (activeReminder) {
      const { key } = activeReminder;
      snoozeRef.current.set(key, Date.now() + snoozeMinutes * 60 * 1000);
      // Marked as fired so the ticker doesn't retrigger the slot; the snooze
      // map owns it from here. The OS notification covers a backgrounded app.
      firedRef.current.add(key);
      setSnoozedSlots((prev) => new Set(prev).add(key));
      if (settings.notifications) {
        scheduleSnooze(activeReminder.medicine, activeReminder.time, snoozeMinutes, language);
      }
    }
    setActiveReminder(null);
  }, [activeReminder, language, settings.notifications, snoozeMinutes]);

  // ---- OS notifications: keep the device schedule in step with the data ----
  useEffect(() => {
    if (!token) return;
    let live = true;
    // Rebuilt whenever the language changes too: a reminder that arrives while
    // the app is closed is the one place the wrong language cannot be fixed
    // after the fact.
    syncScheduledReminders(medicines, settings.notifications, language).then((n) => {
      if (live) setRemindersScheduled(n);
    });
    return () => {
      live = false;
    };
  }, [token, medicines, settings.notifications, language]);

  // ---- tapping a notification reopens the dose sheet ----
  // Covers a notification tapped while the app was closed, too.
  useEffect(() => {
    return addReminderResponseListener((payload) => {
      const med = medicinesRef.current.find((m) => m.id === payload.medicineId);
      if (med) triggerReminder(med, payload.time);
    });
  }, [triggerReminder]);

  // ---- caregiving: load once signed in, then on every foreground ----
  useEffect(() => {
    if (!token) return;
    refreshCaregiving();
  }, [token, refreshCaregiving]);

  /**
   * Announce alerts this phone has not shown yet.
   *
   * The set of announced ids is persisted, so reinstalling the app is the only
   * thing that can make an old alert ring again — and an alert the caregiver
   * left unread does not ring on every sync.
   */
  useEffect(() => {
    if (!token || alerts.length === 0) return;
    const fresh = alerts.filter((a) => !a.readAt && !announcedRef.current.has(a.id));
    if (fresh.length === 0) return;

    for (const alert of fresh) announcedRef.current.add(alert.id);
    storage.set(STORAGE_KEYS.seenAlerts, [...announcedRef.current].slice(-500));

    if (settings.notifications) {
      // Newest last, so the most recent alert is the one left on screen.
      for (const alert of fresh.slice(-5).reverse()) {
        presentCaregiverAlert(alert, language);
      }
    }
  }, [alerts, token, settings.notifications, language]);

  // ---- in-app scheduler loop ----
  // Only runs while the app is in the foreground; the OS schedule covers the
  // rest, and a background timer would be killed by Android anyway.
  useEffect(() => {
    if (!token) return;

    const tick = () => {
      if (AppState.currentState !== "active") return;
      if (activeReminder) return; // one at a time
      const now = new Date();
      const date = todayISO();
      const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      // snoozed reminders first — they are already overdue
      for (const [key, at] of snoozeRef.current.entries()) {
        if (Date.now() >= at) {
          const [medId, , time] = key.split("|");
          const med = medicines.find((m) => m.id === medId);
          snoozeRef.current.delete(key);
          firedRef.current.delete(key);
          setSnoozedSlots((prev) => {
            if (!prev.has(key)) return prev;
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          if (med) {
            triggerReminder(med, time);
            return;
          }
        }
      }

      for (const med of medicines) {
        if (date < med.startDate || date > med.endDate) continue;
        for (const time of med.times) {
          if (time !== cur) continue;
          const key = `${med.id}|${date}|${time}`;
          if (firedRef.current.has(key)) continue;
          firedRef.current.add(key);
          triggerReminder(med, time);
          return;
        }
      }
    };

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [token, medicines, activeReminder, triggerReminder]);

  // ---- reload when the app comes back to the foreground ----
  useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [token, refresh]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    storage.set(STORAGE_KEYS.settings, next);
  }, []);

  /**
   * Switches the app's language.
   *
   * Applied locally first and told to the server afterwards: the switch must
   * be instant and must work offline, and the server's copy only matters for
   * the text it composes itself (a caregiver alert), which can wait.
   */
  const setLanguage = useCallback(
    (next: Language) => {
      updateSettings({ language: next });
      if (!token) return;
      api
        .updateLanguage(next)
        .then((updated) => setUser(updated))
        .catch(() => {
          // Best effort. The phone is the source of truth for the UI, and the
          // next profile save will carry the choice along.
        });
    },
    [token, updateSettings]
  );

  const unreadAlerts = useMemo(() => alerts.filter((a) => !a.readAt).length, [alerts]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      user,
      token,
      medicines,
      history,
      settings,
      activeReminder,
      authLoading,
      refreshing,
      remindersScheduled,
      patientMode: settings.patientMode,
      language,
      t,
      setLanguage,
      register,
      login,
      logout,
      changePassword,
      updateProfile,
      refresh,
      addMedicine,
      editMedicine,
      removeMedicine,
      patients,
      alerts,
      unreadAlerts,
      refreshCaregiving,
      markAlertRead,
      markAllAlertsRead,
      respondReminder,
      snoozeReminder,
      triggerReminder,
      speakReminder,
      snoozeMinutes,
      snoozedSlots,
      updateSettings,
    }),
    [
      ready,
      user,
      token,
      medicines,
      history,
      settings,
      activeReminder,
      authLoading,
      refreshing,
      remindersScheduled,
      language,
      t,
      setLanguage,
      register,
      login,
      logout,
      changePassword,
      updateProfile,
      refresh,
      addMedicine,
      editMedicine,
      removeMedicine,
      patients,
      alerts,
      unreadAlerts,
      refreshCaregiving,
      markAlertRead,
      markAllAlertsRead,
      respondReminder,
      snoozeReminder,
      triggerReminder,
      speakReminder,
      snoozeMinutes,
      snoozedSlots,
      updateSettings,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

/** The palette for the theme the user chose. */
export function useTheme(): Palette {
  const { settings } = useApp();
  return settings.darkMode ? DARK : LIGHT;
}

/**
 * Today's doses, with snoozed ones already marked as such.
 *
 * A thin wrapper over `getTodaySlots` that supplies the snooze set from
 * context, so no screen has to remember to pass it — and none of them can
 * disagree about whether a pushed-back dose counts as missed.
 */
export function useTodaySlots(date?: string): DoseSlot[] {
  const { medicines, history, snoozedSlots } = useApp();
  return useMemo(
    () => getTodaySlots(medicines, history, date ?? todayISO(), snoozedSlots),
    [medicines, history, date, snoozedSlots]
  );
}

/**
 * Whether the phone can speak a reminder, and whether it can do it in the
 * language the app is set to.
 *
 * Two different failures with two different answers. No speech engine at all
 * means the feature cannot work and the switch should say so. An engine with
 * no Nepali voice is the common case on Android — the switch still works, but
 * the reminder may come out silent or in an English voice, and the person
 * turning it on deserves to be told before they rely on it.
 *
 *   hasLanguageVoice === null   still being looked up
 *
 * `hint` is the sentence that goes with whichever of those it is, resolved
 * here so the two screens showing this switch cannot drift apart on what a
 * silent phone is told.
 */
export function useVoiceStatus(): {
  available: boolean;
  hasLanguageVoice: boolean | null;
  hint: TranslationKey;
} {
  const { language } = useApp();
  const available = speechAvailable();
  const [hasLanguageVoice, setHasLanguageVoice] = useState<boolean | null>(null);

  useEffect(() => {
    if (!available) {
      setHasLanguageVoice(false);
      return;
    }
    let live = true;
    setHasLanguageVoice(null);
    hasVoiceFor(language).then((ok) => {
      if (live) setHasLanguageVoice(ok);
    });
    return () => {
      live = false;
    };
  }, [available, language]);

  const hint: TranslationKey = !available
    ? Platform.OS === "web"
      ? "settings.voiceUnavailableWeb"
      : "settings.voiceUnavailable"
    : hasLanguageVoice === false
      ? "settings.voiceNoLanguage"
      : "settings.voiceReminderHint";

  return { available, hasLanguageVoice, hint };
}

/**
 * The translator, on its own.
 *
 * Most components need the words and nothing else; taking `t` from here rather
 * than destructuring `useApp()` keeps that intent visible at the call site.
 */
export function useT(): Translator {
  return useApp().t;
}
