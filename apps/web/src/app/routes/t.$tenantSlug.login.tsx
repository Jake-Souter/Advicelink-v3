import { Navigate, createFileRoute } from '@tanstack/react-router';
import { useState, type FormEvent, type ReactElement } from 'react';

import { Alert, Button, Field, FieldGroup, Input, Stack, Surface } from '@advicelink/ui';

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
 *
 * The login Card is one of the few legitimate uses of `<Surface>`
 * outside the dashboard — it's a focused authentication panel on a
 * centred backdrop, not a content section that could live flush
 * against the inset.
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
      <Surface
        title={`Sign in to ${tenant.displayName}`}
        actions={<img src="/ready-advice-logo.png" alt={tenant.displayName} width={140} />}
      >
        <form onSubmit={handleEmailSubmit}>
          <Stack gap={5}>
            <FieldGroup>
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </Field>
            </FieldGroup>

            {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

            <Button type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>

            <Button
              type="button"
              tone="secondary"
              onClick={() => {
                void handleGoogleSubmit();
              }}
              disabled={submitting}
            >
              Continue with Google
            </Button>
          </Stack>
        </form>
      </Surface>
    </main>
  );
}
