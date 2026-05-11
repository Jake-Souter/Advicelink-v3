import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth';

import { env } from '../config/env';

/**
 * Firebase Web SDK singletons.
 *
 * The app and auth instances are intentionally module-level (not React
 * context) — Firebase already maintains its own internal singleton
 * registry and re-initialising it across HMR / re-renders triggers
 * `app/duplicate-app` errors. The React surface lives in
 * `app/providers/AuthProvider.tsx` which subscribes to
 * `onAuthStateChanged` and exposes a typed `useAuth()` hook.
 *
 * Persistence is `browserLocalPersistence` (default for Firebase) so a
 * full page refresh keeps the user signed in. The `setPersistence` call
 * is awaited inside `AuthProvider`'s bootstrap so the very first
 * `onAuthStateChanged` emission is already against the persisted store.
 */
let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!cachedApp) {
    cachedApp = initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    });
  }
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseApp());
  }
  return cachedAuth;
}

export async function bootstrapFirebaseAuth(): Promise<Auth> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  return auth;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  // Force the account chooser so users on shared machines never sign
  // in as the previously cached Google account by accident.
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
}

/** Map Firebase Auth error codes to short user-facing messages. */
export function describeAuthError(err: unknown): string {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return 'Sign-in failed. Please try again.';
  }
  const code = String((err as { code: unknown }).code);
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your administrator.';
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in window was closed before completing.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}
