import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent, type ReactElement } from 'react';

import type { BreadcrumbItemData } from '@advicelink/ui';

import { AppShell } from '../components/AppShell';
import { Field } from '../forms/Field';
import { trpc } from '../../lib/trpc';

/**
 * `/t/$tenantSlug/clients/new`
 *
 * Two flows, one route. Branches on `whoami.user.role`:
 *
 *   - lead_gen: a destination-advice-firm dropdown is shown,
 *     populated by `tenants.listGrantedAdviceFirms`. Submit calls
 *     `clients.create` with `destinationAdviceTenantId`.
 *   - advice family (adviser, paraplanner, uf_support, super-admins):
 *     no dropdown — the actor's own tenant is the destination. The
 *     server enforces this in `createClient`.
 *
 * The minimum payload is `firstName + surname`. The wizard collects
 * the rest after the row exists; locking the Fact Find later
 * enforces the §11.1 required-field set.
 */
export const Route = createFileRoute('/t/$tenantSlug/_authed/clients/new')({
  component: NewClientPage,
});

function NewClientPage(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const navigate = useNavigate();
  const whoami = trpc.auth.whoami.useQuery();
  const grants = trpc.tenants.listGrantedAdviceFirms.useQuery();
  const create = trpc.clients.create.useMutation();

  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [destinationId, setDestinationId] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isLeadGen = whoami.data?.user.role === 'lead_gen';
  const requireDestination = isLeadGen;

  function validate(): string | null {
    if (firstName.trim().length === 0) return 'First name is required';
    if (surname.trim().length === 0) return 'Surname is required';
    if (requireDestination && destinationId.length === 0) {
      return 'Choose the destination advice firm';
    }
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSubmitError(null);
    const v = validate();
    if (v) {
      setSubmitError(v);
      return;
    }
    create.mutate(
      {
        personal: { firstName: firstName.trim(), surname: surname.trim() },
        ...(requireDestination ? { destinationAdviceTenantId: destinationId } : {}),
      },
      {
        onSuccess: (created) => {
          void navigate({
            to: '/t/$tenantSlug/clients/$clientId/fact-find',
            params: { tenantSlug, clientId: created.id },
            search: { section: 'personal' },
          });
        },
        onError: (err) => {
          setSubmitError(err.message);
        },
      },
    );
  }

  const breadcrumbs: BreadcrumbItemData[] = [
    { id: 'clients', label: 'Clients', to: `/t/${tenantSlug}/clients` },
    { id: 'new', label: 'New client' },
  ];

  return (
    <AppShell tenantSlug={tenantSlug} breadcrumbs={breadcrumbs}>
      <header>
        <h1 style={{ margin: 0 }}>New client</h1>
      </header>

      {whoami.isPending ? (
        <p>Loading…</p>
      ) : (
        <div data-card style={{ maxWidth: '36rem' }}>
          {isLeadGen ? (
            <p data-banner data-tone="info" style={{ marginBottom: '1rem' }}>
              You&rsquo;re creating this client on behalf of an advice firm. The advice firm you
              select will own the client once the onboarding pack is signed.
            </p>
          ) : (
            <p data-banner data-tone="info" style={{ marginBottom: '1rem' }}>
              This client will belong to {whoami.data?.tenant.displayName} from creation.
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <div data-row-grid>
              <Field label="First name" required>
                <input
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={create.isPending}
                />
              </Field>
              <Field label="Surname" required>
                <input
                  type="text"
                  autoComplete="family-name"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  disabled={create.isPending}
                />
              </Field>
            </div>

            {requireDestination ? (
              <div style={{ marginTop: '1rem' }}>
                <Field
                  label="Destination advice firm"
                  required
                  help={
                    grants.isPending
                      ? 'Loading firms…'
                      : grants.data && grants.data.length > 0
                        ? 'Pick the advice firm that will receive this client.'
                        : 'Your tenant does not have any active grants. Ask the advice firm to grant access first.'
                  }
                >
                  <select
                    value={destinationId}
                    onChange={(e) => setDestinationId(e.target.value)}
                    disabled={create.isPending || grants.isPending}
                  >
                    <option value="">Choose a firm…</option>
                    {grants.data?.map((firm) => (
                      <option key={firm.id} value={firm.id}>
                        {firm.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : null}

            {submitError ? (
              <p data-banner data-tone="danger" role="alert" style={{ marginTop: '1rem' }}>
                {submitError}
              </p>
            ) : null}

            <div data-form-actions>
              <button
                type="button"
                data-button="secondary"
                onClick={() => {
                  void navigate({ to: '/t/$tenantSlug/clients', params: { tenantSlug } });
                }}
                disabled={create.isPending}
              >
                Cancel
              </button>
              <button type="submit" data-button="primary" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create client'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
