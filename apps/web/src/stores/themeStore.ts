import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggleTheme: () => {
        const next = !get().isDark;
        set({ isDark: next });
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
    }),
    { name: 'theme-storage' }
  )
);

/** Call once on app boot to apply the persisted preference before first paint. */
export function applyPersistedTheme() {
  try {
    const stored = localStorage.getItem('theme-storage');
    if (stored) {
      const parsed = JSON.parse(stored) as { state?: { isDark?: boolean } };
      if (parsed?.state?.isDark) {
        document.documentElement.classList.add('dark');
      }
    }
  } catch {
    // ignore parse errors
  }
}