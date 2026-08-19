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
import { AppState } from "react-native";

import { DARK, LIGHT, SNOOZE_MINUTES, STORAGE_KEYS, type Palette } from "../constants/theme";
import { startAlarm, stopAlarm } from "../notifications/alarm";
import {
  addReminderResponseListener,
  cancelAllReminders,
  requestPermission,
  scheduleSnooze,
  syncScheduledReminders,
} from "../notifications/reminders";
import * as api from "../services/api";
import type { HistoryEntry, HistoryStatus, Medicine, Settings, User } from "../types";
import { todayISO } from "../utils/date";
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
  // reminders
  respondReminder: (status: HistoryStatus, note?: string) => void;
  snoozeReminder: () => void;
  triggerReminder: (medicine: Medicine, time: string) => void;
  // settings
  updateSettings: (patch: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
  notifications: true,
  alarmSound: true,
  volume: 0.6,
  darkMode: false,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  // AsyncStorage is async, so stored settings arrive after the first render.
  // Persisting before they land would overwrite them with the defaults.
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [activeReminder, setActiveReminder] = useState<ActiveReminder | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const firedRef = useRef<Set<string>>(new Set());
  const snoozeRef = useRef<Map<string, number>>(new Map()); // key -> timestamp to fire
  const medicinesRef = useRef<Medicine[]>([]);
  medicinesRef.current = medicines;

  // ---- bootstrap ----
  useEffect(() => {
    (async () => {
      const stored = await storage.get<Partial<Settings>>(STORAGE_KEYS.settings, {});
      setSettings({ ...defaultSettings, ...stored });
      setSettingsLoaded(true);
      try {
        // Checks the stored token with the server and drops it if it is no
        // longer valid, so a stale session can't leave the app "signed in"
        // with every request failing.
        const session = await api.restoreSession();
        if (session) {
          setToken(session.token);
          setUser(session.user);
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

  // ---- persist settings ----
  useEffect(() => {
    if (!settingsLoaded) return;
    storage.set(STORAGE_KEYS.settings, settings);
  }, [settings, settingsLoaded]);

  const loadData = useCallback(async () => {
    setMedicines(await api.getMedicines());
    setHistory(await api.getHistory());
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await loadData();
    } catch {
      // Pull-to-refresh should never throw into the screen; the last data stands.
    } finally {
      setRefreshing(false);
    }
  }, [loadData, token]);

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
    await cancelAllReminders();
    firedRef.current.clear();
    snoozeRef.current.clear();
    setActiveReminder(null);
    setToken(null);
    setUser(null);
    setMedicines([]);
    setHistory([]);
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

  // ---- REMINDERS ----
  const triggerReminder = useCallback(
    (medicine: Medicine, time: string) => {
      const date = todayISO();
      const key = `${medicine.id}|${date}|${time}`;
      setActiveReminder({ key, medicine, time, date });
      if (settings.alarmSound) {
        startAlarm(settings.volume);
      }
    },
    [settings.alarmSound, settings.volume]
  );

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
      if (activeReminder) {
        record(status, activeReminder, note);
        firedRef.current.add(activeReminder.key);
        snoozeRef.current.delete(activeReminder.key);
      }
      setActiveReminder(null);
    },
    [activeReminder, record]
  );

  const snoozeReminder = useCallback(() => {
    stopAlarm();
    if (activeReminder) {
      snoozeRef.current.set(activeReminder.key, Date.now() + SNOOZE_MINUTES * 60 * 1000);
      // Marked as fired so the ticker doesn't retrigger the slot; the snooze
      // map owns it from here. The OS notification covers a backgrounded app.
      firedRef.current.add(activeReminder.key);
      if (settings.notifications) {
        scheduleSnooze(activeReminder.medicine, activeReminder.time, SNOOZE_MINUTES);
      }
    }
    setActiveReminder(null);
  }, [activeReminder, settings.notifications]);

  // ---- OS notifications: keep the device schedule in step with the data ----
  useEffect(() => {
    if (!token) return;
    syncScheduledReminders(medicines, settings.notifications);
  }, [token, medicines, settings.notifications]);

  // ---- tapping a notification reopens the dose sheet ----
  // Covers a notification tapped while the app was closed, too.
  useEffect(() => {
    return addReminderResponseListener((payload) => {
      const med = medicinesRef.current.find((m) => m.id === payload.medicineId);
      if (med) triggerReminder(med, payload.time);
    });
  }, [triggerReminder]);

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
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

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
      register,
      login,
      logout,
      changePassword,
      updateProfile,
      refresh,
      addMedicine,
      editMedicine,
      removeMedicine,
      respondReminder,
      snoozeReminder,
      triggerReminder,
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
      register,
      login,
      logout,
      changePassword,
      updateProfile,
      refresh,
      addMedicine,
      editMedicine,
      removeMedicine,
      respondReminder,
      snoozeReminder,
      triggerReminder,
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
