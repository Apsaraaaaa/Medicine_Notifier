import AsyncStorage from "@react-native-async-storage/async-storage";

/** JSON-encoded AsyncStorage, so callers deal in values rather than strings. */
export const storage = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const result = await storage.read<T>(key);
    return result.ok && result.value !== null ? result.value : fallback;
  },

  /**
   * A read that says whether it actually succeeded.
   *
   * `get` cannot: it answers "nothing stored" and "the read failed" with the
   * same fallback. That is fine for a cache, and wrong for anything the app
   * writes back to the same key — settings, for instance, where mistaking a
   * failed read for an empty one means saving the defaults over what the user
   * actually chose, and losing it for good.
   *
   *   ok: false            the read threw, or the stored JSON is unparseable
   *   ok: true, value null  nothing has been stored under this key yet
   */
  async read<T>(key: string): Promise<{ ok: boolean; value: T | null }> {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(key);
    } catch {
      return { ok: false, value: null };
    }
    if (raw === null) return { ok: true, value: null };
    try {
      return { ok: true, value: JSON.parse(raw) as T };
    } catch {
      // Stored, but corrupt. Reported as a failure so the caller leaves it
      // alone rather than overwriting whatever is there.
      return { ok: false, value: null };
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
