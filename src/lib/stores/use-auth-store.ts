'use client';

import { create } from 'zustand';

/**
 * Simplified Authentication Store
 * Uses local storage only - no authentication required
 * App works in "always logged in" mode for local development
 */

const DEV_USER_ID = "local-user-00000000-0000-0000-0000-000000000000";
const DEV_USER_EMAIL = "user@localhost";

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
}

interface AuthActions {
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: () => boolean;
  setLoading: (loading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  loading: true,
  initialized: false,
};

export const useAuthStore = create<AuthStore>()((set, get) => ({
  ...initialState,

  initialize: async () => {
    if (get().initialized) return;

    // Always create a local user - no authentication required
    const localUser: AuthUser = {
      id: DEV_USER_ID,
      email: DEV_USER_EMAIL,
      user_metadata: {},
    };

    set({
      user: localUser,
      loading: false,
      initialized: true,
    });
  },

  signOut: async () => {
    // In local mode, signing out just resets to initial state
    // but we'll immediately recreate the local user
    const localUser: AuthUser = {
      id: DEV_USER_ID,
      email: DEV_USER_EMAIL,
      user_metadata: {},
    };

    set({
      user: localUser,
      loading: false,
      initialized: true,
    });
  },

  isAuthenticated: () => {
    const { user } = get();
    return !!user;
  },

  setLoading: (loading) => set({ loading }),
}));
