import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useState, type ReactElement } from 'react';
import { ClipboardList } from 'lucide-react';
import { z } from 'zod';

import {
  Alert,
  Button,
  PageHeader,
  type AppShellNavGroup,
  type BreadcrumbItemData,
} from '@advicelink/ui';
import {
  factFindSectionSchemas,
  type FactFindSectionId,
  type Personal,
  type Superannuation,
} from '@advicelink/schemas';

import { trpc } from '../../lib/trpc';
import { AppShell } from '../components/AppShell';
import { SECTION_GROUPS, SECTION_META } from '../factFind/sectionMeta';
import { AssetLiabilityEditor } from '../factFind/AssetLiabilityEditor';
import { BeneficiariesEditor } from '../factFind/BeneficiariesEditor';
import { ContributionsEditor } from '../factFind/ContributionsEditor';
import { EmploymentEditor } from '../factFind/EmploymentEditor';
import { FinancialEditor } from '../factFind/FinancialEditor';
import { GoalsEditor } from '../factFind/GoalsEditor';
import { InsuranceEditor } from '../factFind/InsuranceEditor';
import { PersonalEditor } from '../factFind/PersonalEditor';
import { RiskProfileEditor } from '../factFind/RiskProfileEditor';
import { SuperannuationEditor } from '../factFind/SuperannuationEditor';
import { assetsSchema } from '@advicelink/schemas';

/**
 * `/t/$tenantSlug/clients/$clientId/fact-find` — the wizard.
 *
 * One file holds the shell + side nav + the routing-equivalent
 * switch over the active section. The active section is carried in
 * the `?section=...` search param so deep links land on the right
 * pane. The default is `personal`.
 *
 * The shell pulls one full `factFind.loadByClientId` payload. Each
 * editor receives the raw section value + a save callback that POSTs
 * a single section through `factFind.upsertSection`. Successful saves
 * invalidate the load query; the editors' `useDraftSection` hook
 * picks up the fresh server value when the user is idle.
 */

const sectionParam = z.enum(
  Object.keys(factFindSectionSchemas) as [FactFindSectionId, ...FactFindSectionId[]],
);

export const Route = createFileRoute('/t/$tenantSlug/_authed/clients/$clientId/fact-find')({
  component: FactFindPage,
  validateSearch: (search) => ({
    section:
      typeof search.section === 'string' && sectionParam.safeParse(search.section).success
        ? (search.section as FactFindSectionId)
        : ('personal' as FactFindSectionId),
  }),
});

function FactFindPage(): ReactElement {
  const { tenantSlug, clientId } = Route.useParams();
  const { section } = Route.useSearch();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const load = trpc.factFind.loadByClientId.useQuery({ clientId });
  const upsert = trpc.factFind.upsertSection.useMutation({
    onSuccess: () => {
      void utils.factFind.loadByClientId.invalidate({ clientId });
      void utils.clients.list.invalidate();
      void utils.clients.byId.invalidate({ clientId });
    },
  });
  const lock = trpc.clients.lockFactFind.useMutation({
    onSuccess: () => {
      void utils.factFind.loadByClientId.invalidate({ clientId });
      void utils.clients.list.invalidate();
      void utils.clients.byId.invalidate({ clientId });
    },
  });

  const [lockError, setLockError] = useState<string | null>(null);

  function navigateToSection(next: FactFindSectionId): void {
    void navigate({
      to: '/t/$tenantSlug/clients/$clientId/fact-find',
      params: { tenantSlug, clientId },
      search: { section: next },
    });
  }

  // Build the Fact Find sub-nav for the sidebar — one collapsible
  // "Fact Find" entry per page-meta group, each with its sections as
  // active-aware child links. The data is derived before the early
  // returns so loading/error views still get the same shell shape.
  const factFindNavGroup = useMemo<AppShellNavGroup>(() => {
    return {
      id: 'fact-find',
      label: 'Fact Find',
      items: SECTION_GROUPS.map((group) => {
        const sections = SECTION_META.filter((s) => s.group === group);
        const activeInGroup = sections.some((s) => s.id === section);
        return {
          id: `ff-group-${group}`,
          label: group,
          to: `/t/${tenantSlug}/clients/${clientId}/fact-find`,
          icon: ClipboardList,
          isActive: activeInGroup,
          defaultOpen: activeInGroup,
          items: sections.map((s) => ({
            id: s.id,
            label: s.label,
            to: `/t/${tenantSlug}/clients/${clientId}/fact-find?section=${s.id}`,
            isActive: s.id === section,
            onSelect: () => navigateToSection(s.id),
          })),
        };
      }),
    };
  }, [section, tenantSlug, clientId]);

  const breadcrumbs = useMemo<BreadcrumbItemData[]>(() => {
    const displayName = load.data?.meta.displayName ?? '(unnamed)';
    const sectionLabel = SECTION_META.find((s) => s.id === section)?.label ?? 'Fact Find';
    return [
      { id: 'clients', label: 'Clients', to: `/t/${tenantSlug}/clients` },
      {
        id: 'client',
        label: displayName,
        to: `/t/${tenantSlug}/clients/${clientId}/fact-find`,
      },
      { id: 'section', label: `Fact Find · ${sectionLabel}` },
    ];
  }, [load.data?.meta.displayName, section, tenantSlug, clientId]);

  if (load.isPending) {
    return (
      <AppShell
        tenantSlug={tenantSlug}
        extraNavGroups={[factFindNavGroup]}
        breadcrumbs={breadcrumbs}
      >
        <Alert tone="neutral">Loading Fact Find…</Alert>
      </AppShell>
    );
  }
  if (load.isError) {
    return (
      <AppShell
        tenantSlug={tenantSlug}
        extraNavGroups={[factFindNavGroup]}
        breadcrumbs={breadcrumbs}
      >
        <Alert tone="danger" title="Couldn't load Fact Find">
          {load.error.message}
        </Alert>
      </AppShell>
    );
  }

  const { meta, sections } = load.data;
  const isLocked = meta.factFindLockedAt != null;
  const factsBullets = computeFactsBullets(sections.personal as Personal | undefined);

  async function handleSave(sectionId: FactFindSectionId, parsed: unknown): Promise<void> {
    await upsert.mutateAsync({ clientId, sectionId, payload: parsed });
  }

  function handleLock(): void {
    setLockError(null);
    lock.mutate({ clientId }, { onError: (err) => setLockError(err.message) });
  }

  return (
    <AppShell tenantSlug={tenantSlug} extraNavGroups={[factFindNavGroup]} breadcrumbs={breadcrumbs}>
      <PageHeader
        title="Fact Find"
        actions={
          isLocked ? null : (
            <Button onClick={handleLock} disabled={lock.isPending}>
              {lock.isPending ? 'Locking…' : 'Lock Fact Find'}
            </Button>
          )
        }
      />

      {isLocked ? (
        <Alert tone="success" title="Fact Find locked">
          Locked at {meta.factFindLockedAt?.toLocaleString('en-AU')}
        </Alert>
      ) : null}
      {lockError ? <Alert tone="danger">{lockError}</Alert> : null}

      <SectionEditor
        sectionId={section}
        serverSections={sections}
        onSave={(parsed) => handleSave(section, parsed)}
        isLocked={isLocked}
        clientId={clientId}
        clientDisplayName={meta.displayName || '(unnamed)'}
        factsBullets={factsBullets}
      />
    </AppShell>
  );
}

interface SectionEditorProps {
  sectionId: FactFindSectionId;
  serverSections: Record<FactFindSectionId, unknown>;
  onSave: (parsed: unknown) => Promise<void>;
  isLocked: boolean;
  clientId: string;
  clientDisplayName: string;
  factsBullets: string[];
}

/**
 * Per-section dispatcher. Every section now has a bespoke editor
 * (WP-6.5); the legacy generic JSON-editor fallback is retired.
 * `factFindSectionSchemas` is still consulted at the leaf level
 * via the editor props (each editor imports its own canonical
 * schema), and `SECTION_META` remains the single source of truth
 * for sidebar labels — but the dispatcher now hard-codes a switch
 * so adding a new section forces an explicit editor wiring step.
 */
function SectionEditor(props: SectionEditorProps): ReactElement {
  void useMemo(() => SECTION_META.find((s) => s.id === props.sectionId), [props.sectionId]);
  void factFindSectionSchemas; // kept imported so future per-section custom forms can opt in.

  const value = props.serverSections[props.sectionId];

  switch (props.sectionId) {
    case 'personal':
      return (
        <PersonalEditor
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
        />
      );
    case 'employment':
      return (
        <EmploymentEditor
          heading="Employment"
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
        />
      );
    case 'financial':
      return (
        <FinancialEditor
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
        />
      );
    case 'assets':
      return (
        <AssetLiabilityEditor
          heading="Assets and Liabilities"
          description="One row per asset or debt. Standalone debts (no underlying asset) sit alongside your assets — set the asset value to 0 and fill the loan fields."
          schema={assetsSchema}
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
          totalsLabel="assets and liabilities"
          itemListLabel="Asset / liability rows"
          rowMax={50}
        />
      );
    case 'superannuation':
      return (
        <SuperannuationEditor
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
        />
      );
    case 'contributions':
      return (
        <ContributionsEditor
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
          superannuation={props.serverSections.superannuation as Superannuation | undefined}
        />
      );
    case 'insurance':
      return (
        <InsuranceEditor
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
        />
      );
    case 'beneficiaries':
      return (
        <BeneficiariesEditor
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
        />
      );
    case 'goals':
      return (
        <GoalsEditor
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
          clientId={props.clientId}
          clientDisplayName={props.clientDisplayName}
          factsBullets={props.factsBullets}
        />
      );
    case 'riskProfile':
      return (
        <RiskProfileEditor
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
        />
      );
  }
}

/**
 * Build a redacted-friendly bullet summary that the AI assist
 * surface uses as context. The redaction layer in `@advicelink/ai`
 * scrubs anything that slips through, but we narrow the input
 * upstream so the prompt is small and focused.
 */
function computeFactsBullets(personal: Personal | undefined): string[] {
  const bullets: string[] = [];
  if (personal?.dateOfBirth) bullets.push(`DOB: ${personal.dateOfBirth}`);
  if (personal?.maritalStatus) bullets.push(`Marital status: ${personal.maritalStatus}`);
  if (personal?.hasDependants === true && personal.dependants.length > 0) {
    bullets.push(`Dependants: ${personal.dependants.length}`);
  }
  if (personal?.smokerStatus) bullets.push(`Smoker: ${personal.smokerStatus}`);
  if (personal?.partnerName) bullets.push(`Partner: present`);
  return bullets;
}
