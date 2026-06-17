import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  /** User's explicit preference. 'system' follows the OS setting. */
  theme: ThemeMode;
  /** Resolved value actually applied to <html>. */
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveIsDark(mode: ThemeMode): boolean {
  return mode === 'system' ? systemPrefersDark() : mode === 'dark';
}

function applyClass(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      isDark: false,
      setTheme: (mode) => {
        const isDark = resolveIsDark(mode);
        applyClass(isDark);
        set({ theme: mode, isDark });
      },
      toggleTheme: () => {
        const next = !get().isDark;
        applyClass(next);
        set({ theme: next ? 'dark' : 'light', isDark: next });
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Older persisted state only had `isDark`; derive a mode from it.
        const mode: ThemeMode = state.theme ?? (state.isDark ? 'dark' : 'light');
        const isDark = resolveIsDark(mode);
        applyClass(isDark);
        state.theme = mode;
        state.isDark = isDark;
      },
    }
  )
);

// Keep the resolved class in sync when the OS theme changes and the user is on 'system'.
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme, setTheme } = useThemeStore.getState();
    if (theme === 'system') setTheme('system');
  });
}

/** Call once on app boot to apply the persisted preference before first paint. */
export function applyPersistedTheme() {
  try {
    const stored = localStorage.getItem('theme-storage');
    let mode: ThemeMode = 'system';
    if (stored) {
      const parsed = JSON.parse(stored) as { state?: { theme?: ThemeMode; isDark?: boolean } };
      mode = parsed?.state?.theme ?? (parsed?.state?.isDark ? 'dark' : 'light');
    }
    applyClass(resolveIsDark(mode));
  } catch {
    // ignore parse errors
  }
}
