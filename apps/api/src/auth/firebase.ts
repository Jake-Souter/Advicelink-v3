import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';

import { env } from '../config/env.js';

/**
 * Firebase Admin SDK singleton. We deliberately initialise once per
 * process — the SDK is internally pooled and re-using the same App
 * instance is the recommended pattern. REBUILD_PLAN §12.1 / §19.12.
 *
 * The App ID is namespaced as 'advicelink-api' so test fixtures (or a
 * future workers process running in the same Node) can co-exist with
 * their own Firebase App without colliding on the default name.
 *
 * Initialisation is **lazy**: `cert()` parses the PEM at call time and
 * crashes on a stub key, which would prevent vitest from even loading
 * the module graph for integration tests that legitimately plan to
 * skip. Deferring the call keeps the module import side-effect-free
 * while still memoising for production hot paths.
 */
const APP_NAME = 'advicelink-api';

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;

function getOrInitApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) {
    cachedApp = existing;
    return existing;
  }
  cachedApp = initializeApp(
    {
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }),
      projectId: env.FIREBASE_PROJECT_ID,
    },
    APP_NAME,
  );
  return cachedApp;
}

export function getFirebaseApp(): App {
  return getOrInitApp();
}

export function getFirebaseAuth(): Auth {
  if (!cachedAuth) cachedAuth = getAuth(getOrInitApp());
  return cachedAuth;
}

export type VerifiedFirebaseToken = DecodedIdToken;

export class FirebaseAuthError extends Error {
  constructor(
    public readonly code: 'missing_token' | 'invalid_token' | 'expired_token' | 'revoked_token',
    message: string,
  ) {
    super(message);
    this.name = 'FirebaseAuthError';
  }
}

/**
 * Verify a Firebase ID token and return the decoded claims, or throw a
 * `FirebaseAuthError` with a typed `code` so the tRPC error formatter
 * can map it to a stable client-facing error envelope (§19.21).
 *
 * `checkRevoked: true` makes the call slightly slower (one round-trip
 * to Firebase) but ensures a logged-out / disabled user can never
 * present a still-valid JWT — REBUILD_PLAN §12.1 mandates this.
 */
export async function verifyIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  if (!idToken || idToken.trim() === '') {
    throw new FirebaseAuthError('missing_token', 'Firebase ID token is required');
  }
  try {
    return await getFirebaseAuth().verifyIdToken(idToken, true);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? '';
    if (code === 'auth/id-token-expired') {
      throw new FirebaseAuthError('expired_token', 'Firebase ID token has expired');
    }
    if (code === 'auth/id-token-revoked' || code === 'auth/user-disabled') {
      throw new FirebaseAuthError('revoked_token', 'Firebase ID token has been revoked');
    }
    throw new FirebaseAuthError(
      'invalid_token',
      `Firebase ID token is invalid: ${(err as Error).message}`,
    );
  }
}
