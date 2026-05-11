import { Navigate, createFileRoute } from '@tanstack/react-router';
import { useState, type FormEvent, type ReactElement } from 'react';

import { Stack } from '@advicelink/ui';

import { useAuth } from '../providers/AuthProvider';
import { useTenant } from '../providers/TenantProvider';
import { describeAuthError, signInWithEmail, signInWithGoogle } from '../../lib/firebase';

/**
 * Login screen — themed by the tenant's brand bundle (loaded by the
 * parent `/t/$tenantSlug` route). Email/password and Google providers
 * are wired; Microsoft Identity Platform is intentionally deferred per
 * the user's setup decision (see Doppler/Firebase console state).
 *
 * On successful sign-in the `AuthProvider` flips its state machine to
 * `signedIn`, the conditional `<Navigate>` at the top of the
 * component fires, and the user lands at `/t/$tenantSlug/home`.
 */
export const Route = createFileRoute('/t/$tenantSlug/login')({
  component: LoginPage,
});

function LoginPage(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const { status } = useAuth();
  const tenant = useTenant();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (status === 'signedIn') {
    return <Navigate to="/t/$tenantSlug/home" params={{ tenantSlug }} replace />;
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setErrorMessage(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSubmit() {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setErrorMessage(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main data-page="login">
      <section data-login-card>
        <Stack gap={4}>
          <header data-login-header>
            <Stack gap={2} align="center">
              <img src="/ready-advice-logo.png" alt={tenant.displayName} width={220} />
              <h1>Sign in to {tenant.displayName}</h1>
            </Stack>
          </header>

          <form onSubmit={handleEmailSubmit} data-login-form>
            <Stack gap={3}>
              <label data-field>
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </label>
              <label data-field>
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </label>
              {errorMessage ? (
                <p role="alert" data-login-error>
                  {errorMessage}
                </p>
              ) : null}
              <button type="submit" data-button="primary" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </Stack>
          </form>

          <div data-login-divider>
            <span>or</span>
          </div>

          <button
            type="button"
            data-button="secondary"
            onClick={() => {
              void handleGoogleSubmit();
            }}
            disabled={submitting}
          >
            Continue with Google
          </button>
        </Stack>
      </section>
    </main>
  );
}
