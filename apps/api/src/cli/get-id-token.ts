import { env } from '../config/env.js';

/**
 * Smoke-test helper. Signs in to Firebase Auth via the email/password
 * REST endpoint (the same one the Web SDK calls under the hood) and
 * prints an ID token suitable for `Authorization: Bearer ...` against
 * the API.
 *
 * Usage:
 *   doppler run -- pnpm --filter @advicelink/api get-id-token \
 *     -- --email you@example.com --password yourpassword
 *
 * REQUIRES `FIREBASE_WEB_API_KEY` in Doppler (the public Web SDK key
 * from the Firebase console — `firebaseConfig.apiKey`). Stored alongside
 * the Admin credentials so the smoke-test script can run from any
 * developer's laptop without a separate config file.
 *
 * Tokens expire after 1 hour. Re-run as needed.
 */

interface SignInResponse {
  idToken: string;
  email: string;
  localId: string;
  refreshToken: string;
  expiresIn: string;
}

interface ErrorResponse {
  error?: { message?: string };
}

function parseArgs(argv: readonly string[]): { email: string; password: string } {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--email' || flag === '--password') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value after ${flag}`);
      }
      args.set(flag.slice(2), value);
      i++;
    }
  }
  const email = args.get('email');
  const password = args.get('password');
  if (!email || !password) {
    throw new Error('Both --email and --password are required');
  }
  return { email, password };
}

async function main(): Promise<void> {
  if (!env.FIREBASE_WEB_API_KEY) {
    throw new Error(
      'FIREBASE_WEB_API_KEY is not set in Doppler. Copy `firebaseConfig.apiKey` from the ' +
        'Firebase console (Project settings → Your apps → Web SDK config) into Doppler:\n\n' +
        '  doppler secrets set FIREBASE_WEB_API_KEY=AIza... ' +
        '--project advicelink-api --config dev',
    );
  }

  const { email, password } = parseArgs(process.argv.slice(2));

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_WEB_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrorResponse;
    throw new Error(
      `Firebase signInWithPassword failed (${res.status}): ${body.error?.message ?? res.statusText}`,
    );
  }

  const body = (await res.json()) as SignInResponse;
  // Print token to stdout, everything else to stderr — so callers can
  // capture the token cleanly: TOKEN=$(pnpm get-id-token ... 2>/dev/null)
  console.error(`Signed in as ${body.email} (uid=${body.localId})`);
  console.error(`Token expires in ${body.expiresIn}s\n`);
  console.log(body.idToken);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
