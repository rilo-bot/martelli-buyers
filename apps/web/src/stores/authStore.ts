import { create } from 'zustand';
import { request, ApiError } from '@/lib/api';
import type { User } from '@/types';

type AuthStatus = 'loading' | 'ready';

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AuthState {
  currentUser: User | null;
  /** 'loading' until the initial /me check resolves; gates ProtectedRoute. */
  status: AuthStatus;
  /** Run once on app boot to restore the session from the cookie. */
  init: () => Promise<void>;
  /**
   * Silently re-check the session. Distinguishes a real 401 (signed out) from
   * the server being unreachable (network error / 5xx) — the latter must NOT
   * drop the session, otherwise restarting the API kicks everyone to /login.
   */
  recheck: () => Promise<void>;
  /** Email a one-time sign-in code (only sent to existing accounts). */
  requestOtp: (email: string) => Promise<AuthResult>;
  /** Verify the code, establish a session, and load the user. */
  verifyOtp: (email: string, code: string) => Promise<AuthResult>;
  /** Open an invite link: auto-login with the token and load the user. */
  acceptInvite: (token: string) => Promise<AuthResult>;
  /** Update your own profile (name and/or avatar) and refresh currentUser. */
  updateProfile: (patch: { name?: string; avatarUrl?: string }) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
}

/** A 401/403 means genuinely signed out; anything else means we couldn't reach the API. */
function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

// ── Reconnect backoff (module singletons; the store is a singleton too). ──
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;
const MAX_RETRY_DELAY = 10_000;
let wakeListenersBound = false;

function clearRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}
function resetRetry(): void {
  clearRetry();
  retryDelay = 2000;
}
function scheduleRetry(run: () => void): void {
  clearRetry();
  retryTimer = setTimeout(() => {
    retryTimer = null;
    run();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 1.5, MAX_RETRY_DELAY);
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  currentUser: null,
  status: 'loading',

  init: async () => {
    await get().recheck();
    // Self-heal: when the tab regains focus or the network returns, re-check
    // (only while signed out / reconnecting) so a restarted API restores us
    // without the user having to re-enter a code.
    if (!wakeListenersBound && typeof window !== 'undefined') {
      wakeListenersBound = true;
      const wake = () => {
        if (!get().currentUser) void get().recheck();
      };
      window.addEventListener('focus', wake);
      window.addEventListener('online', wake);
    }
  },

  recheck: async () => {
    try {
      const user = await request<User>('GET', '/api/auth/me');
      resetRetry();
      set({ currentUser: user, status: 'ready' });
    } catch (err) {
      if (isUnauthorized(err)) {
        // Genuinely signed out — clear and stop retrying.
        resetRetry();
        set({ currentUser: null, status: 'ready' });
      } else {
        // Server unreachable (down / restarting). Keep any existing session,
        // let the UI proceed, and retry until the API answers again.
        set({ status: 'ready' });
        scheduleRetry(() => void get().recheck());
      }
    }
  },

  requestOtp: async (email) => {
    try {
      await request('POST', '/api/auth/request-otp', { email: email.trim() });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errMessage(err, 'Could not send a code. Please try again.') };
    }
  },

  verifyOtp: async (email, code) => {
    try {
      const user = await request<User>('POST', '/api/auth/verify-otp', { email: email.trim(), code });
      resetRetry();
      set({ currentUser: user, status: 'ready' });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errMessage(err, 'Invalid or expired code.') };
    }
  },

  acceptInvite: async (token) => {
    try {
      const user = await request<User>('POST', '/api/auth/accept-invite', { token });
      resetRetry();
      set({ currentUser: user, status: 'ready' });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errMessage(err, 'This invite link is invalid or has expired.') };
    }
  },

  updateProfile: async (patch) => {
    try {
      // PATCH /me returns the full enriched user (permissions/isSuperAdmin), so
      // replacing currentUser keeps RBAC intact.
      const user = await request<User>('PATCH', '/api/auth/me', patch);
      set({ currentUser: user });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errMessage(err, 'Could not save your profile.') };
    }
  },

  logout: async () => {
    resetRetry();
    set({ currentUser: null });
    try {
      await request('POST', '/api/auth/logout');
    } catch {
      /* best-effort; local state already cleared */
    }
  },
}));
