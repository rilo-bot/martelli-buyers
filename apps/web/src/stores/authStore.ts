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
  /** Email a one-time sign-in code. `name` is applied on first-time signup. */
  requestOtp: (email: string, name?: string) => Promise<AuthResult>;
  /** Verify the code, establish a session, and load the user. */
  verifyOtp: (email: string, code: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
}

export const useAuthStore = create<AuthState>()((set) => ({
  currentUser: null,
  status: 'loading',

  init: async () => {
    try {
      const user = await request<User>('GET', '/api/auth/me');
      set({ currentUser: user, status: 'ready' });
    } catch {
      // 401 (or offline) → no session.
      set({ currentUser: null, status: 'ready' });
    }
  },

  requestOtp: async (email, name) => {
    try {
      await request('POST', '/api/auth/request-otp', { email: email.trim(), name });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errMessage(err, 'Could not send a code. Please try again.') };
    }
  },

  verifyOtp: async (email, code) => {
    try {
      const user = await request<User>('POST', '/api/auth/verify-otp', { email: email.trim(), code });
      set({ currentUser: user, status: 'ready' });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errMessage(err, 'Invalid or expired code.') };
    }
  },

  logout: async () => {
    set({ currentUser: null });
    try {
      await request('POST', '/api/auth/logout');
    } catch {
      /* best-effort; local state already cleared */
    }
  },
}));
