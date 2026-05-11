import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';

import { bootstrapFirebaseAuth, signOut as firebaseSignOut } from '../../lib/firebase';

/**
 * Tracks the current Firebase user and surfaces it via `useAuth()`.
 *
 * The provider drives a three-state machine — `loading` (we have not
 * yet heard back from Firebase about persistence resolution),
 * `signedIn`, `signedOut`. Routes use `loading` to render a splash
 * instead of redirecting to login while the SDK is still hydrating
 * from local storage; otherwise a logged-in user briefly bounces
 * through the login screen on every refresh.
 */
type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    bootstrapFirebaseAuth()
      .then((auth) => {
        if (cancelled) return;
        unsub = onAuthStateChanged(auth, (next) => {
          setUser(next);
          setStatus(next ? 'signedIn' : 'signedOut');
        });
      })
      .catch((err: unknown) => {
        // Persistence may fail in private-browsing modes that block
        // IndexedDB. Firebase falls back to in-memory automatically;
        // we still need to flip the state machine so routes don't
        // hang on the loading splash forever.
        console.error('[AuthProvider] persistence bootstrap failed', err);
        setStatus('signedOut');
      });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signOut: async () => {
        await firebaseSignOut();
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
  return ctx;
}
