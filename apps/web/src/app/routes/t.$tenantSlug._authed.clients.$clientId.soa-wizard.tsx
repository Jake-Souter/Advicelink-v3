import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useState, type ReactElement } from 'react';
import { FileText } from 'lucide-react';
import { z } from 'zod';

import {
  Alert,
  Button,
  Cluster,
  PageHeader,
  type AppShellNavGroup,
  type BreadcrumbItemData,
} from '@advicelink/ui';
import {
  SOA_WIZARD_SECTION_IDS,
  soaWizardSectionSchemas,
  type Personal,
  type SoaWizardSectionId,
} from '@advicelink/schemas';

import { trpc } from '../../lib/trpc';
import { AppShell } from '../components/AppShell';
import {
  SOA_WIZARD_SECTION_GROUPS,
  SOA_WIZARD_SECTION_META,
  type SoaWizardSectionMeta,
} from '../soaWizard/sectionMeta';
import { CoverEditor } from '../soaWizard/CoverEditor';
import { AboutAuthorityEditor } from '../soaWizard/AboutAuthorityEditor';
import { PlaceholderEditor } from '../soaWizard/PlaceholderEditor';

/**
 * `/t/$tenantSlug/clients/$clientId/soa-wizard` — the SOA Wizard.
 *
 * Same shape as the Fact Find route: shell + sub-nav + a switch over
 * the active section. The active section lives in the `?section=...`
 * query param so deep links land on the right pane; default is
 * `cover`.
 *
 * The shell pulls one full `soaWizard.loadByClientId` payload. Each
 * editor receives the raw section value + a save callback that POSTs
 * a single section through `soaWizard.upsertSection`. Successful
 * saves invalidate the load query.
 *
 * The wizard is gated on the Fact Find being locked: pre-lock, every
 * editor surface is hidden behind a "lock the Fact Find first" alert
 * with a link back to the FF page. The API also rejects any save
 * before lock, but the UI guard means a paraplanner never gets a
 * surprising mid-edit error.
 */

const sectionParam = z.enum(
  SOA_WIZARD_SECTION_IDS as unknown as [SoaWizardSectionId, ...SoaWizardSectionId[]],
);

export const Route = createFileRoute('/t/$tenantSlug/_authed/clients/$clientId/soa-wizard')({
  component: SoaWizardPage,
  validateSearch: (search) => ({
    section:
      typeof search.section === 'string' && sectionParam.safeParse(search.section).success
        ? (search.section as SoaWizardSectionId)
        : ('cover' as SoaWizardSectionId),
  }),
});

function SoaWizardPage(): ReactElement {
  const { tenantSlug, clientId } = Route.useParams();
  const { section } = Route.useSearch();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const wizardLoad = trpc.soaWizard.loadByClientId.useQuery({ clientId });
  // The factsBullets passed to AI assist comes from the locked Fact
  // Find — we still need the FF load for that. Cheaply parallel.
  const factFindLoad = trpc.factFind.loadByClientId.useQuery({ clientId });

  const upsert = trpc.soaWizard.upsertSection.useMutation({
    onSuccess: () => {
      void utils.soaWizard.loadByClientId.invalidate({ clientId });
    },
  });
  const refresh = trpc.soaWizard.refreshFromFactFind.useMutation({
    onSuccess: () => {
      void utils.soaWizard.loadByClientId.invalidate({ clientId });
    },
  });

  const [refreshError, setRefreshError] = useState<string | null>(null);

  function navigateToSection(next: SoaWizardSectionId): void {
    void navigate({
      to: '/t/$tenantSlug/clients/$clientId/soa-wizard',
      params: { tenantSlug, clientId },
      search: { section: next },
    });
  }

  // Build the SOA Wizard sub-nav for the sidebar — one collapsible
  // "SOA Wizard" entry per section group, each with its sections as
  // active-aware child links. Mirrors the Fact Find route's nav
  // shape so the AppShell renders both consistently.
  const wizardNavGroup = useMemo<AppShellNavGroup>(() => {
    return {
      id: 'soa-wizard',
      label: 'SOA Wizard',
      items: SOA_WIZARD_SECTION_GROUPS.map((group) => {
        const sections = SOA_WIZARD_SECTION_META.filter((s) => s.group === group);
        const activeInGroup = sections.some((s) => s.id === section);
        return {
          id: `soa-group-${group}`,
          label: group,
          to: `/t/${tenantSlug}/clients/${clientId}/soa-wizard`,
          icon: FileText,
          isActive: activeInGroup,
          defaultOpen: activeInGroup,
          items: sections.map((s) => ({
            id: s.id,
            label: s.label,
            to: `/t/${tenantSlug}/clients/${clientId}/soa-wizard?section=${s.id}`,
            isActive: s.id === section,
            onSelect: () => navigateToSection(s.id),
          })),
        };
      }),
    };
  }, [section, tenantSlug, clientId]);

  const breadcrumbs = useMemo<BreadcrumbItemData[]>(() => {
    const displayName = wizardLoad.data?.meta.displayName ?? '(unnamed)';
    const sectionLabel =
      SOA_WIZARD_SECTION_META.find((s) => s.id === section)?.label ?? 'SOA Wizard';
    return [
      { id: 'clients', label: 'Clients', to: `/t/${tenantSlug}/clients` },
      {
        id: 'client',
        label: displayName,
        to: `/t/${tenantSlug}/clients/${clientId}/fact-find`,
      },
      { id: 'section', label: `SOA Wizard · ${sectionLabel}` },
    ];
  }, [wizardLoad.data?.meta.displayName, section, tenantSlug, clientId]);

  if (wizardLoad.isPending) {
    return (
      <AppShell tenantSlug={tenantSlug} extraNavGroups={[wizardNavGroup]} breadcrumbs={breadcrumbs}>
        <Alert tone="neutral">Loading SOA Wizard…</Alert>
      </AppShell>
    );
  }
  if (wizardLoad.isError) {
    return (
      <AppShell tenantSlug={tenantSlug} extraNavGroups={[wizardNavGroup]} breadcrumbs={breadcrumbs}>
        <Alert tone="danger" title="Couldn't load SOA Wizard">
          {wizardLoad.error.message}
        </Alert>
      </AppShell>
    );
  }

  const { meta, sections } = wizardLoad.data;
  const isFactFindLocked = meta.factFindLockedAt != null;
  // The wizard is also locked once the SOA has been formally
  // presented (REBUILD_PLAN §11.2). Until that gate lands in the
  // workflow we treat `soaPresentedAt` as a soft lock.
  const isPresented = meta.soaPresentedAt != null;
  const isLocked = !isFactFindLocked || isPresented;

  const factsBullets = computeFactsBullets(
    factFindLoad.data?.sections.personal as Personal | undefined,
  );

  async function handleSave(sectionId: SoaWizardSectionId, parsed: unknown): Promise<void> {
    await upsert.mutateAsync({ clientId, sectionId, payload: parsed });
  }

  function handleRefresh(): void {
    setRefreshError(null);
    refresh.mutate(
      { clientId },
      {
        onError: (err) => setRefreshError(err.message),
      },
    );
  }

  return (
    <AppShell tenantSlug={tenantSlug} extraNavGroups={[wizardNavGroup]} breadcrumbs={breadcrumbs}>
      <PageHeader
        title="SOA Wizard"
        actions={
          <Cluster gap={2}>
            <Button
              type="button"
              tone="secondary"
              onClick={handleRefresh}
              disabled={!isFactFindLocked || refresh.isPending}
            >
              {refresh.isPending ? 'Refreshing…' : 'Refresh from Fact Find'}
            </Button>
          </Cluster>
        }
      />

      {!isFactFindLocked ? (
        <Alert tone="warning" title="Fact Find not locked">
          The SOA Wizard becomes editable once the Fact Find is locked. Lock the Fact Find first.
        </Alert>
      ) : null}
      {isPresented ? (
        <Alert tone="success" title="SOA presented">
          The SOA was presented at {meta.soaPresentedAt?.toLocaleString('en-AU')}; further edits
          require an ROA / EO run.
        </Alert>
      ) : null}
      {refreshError ? (
        <Alert tone="danger" title="Refresh failed">
          {refreshError}
        </Alert>
      ) : null}

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
  sectionId: SoaWizardSectionId;
  serverSections: Record<SoaWizardSectionId, unknown>;
  onSave: (parsed: unknown) => Promise<void>;
  isLocked: boolean;
  clientId: string;
  clientDisplayName: string;
  factsBullets: string[];
}

/**
 * Per-section dispatcher. Two sections (`cover`, `aboutAuthority`)
 * have bespoke editors; the other thirteen render the generic
 * `PlaceholderEditor` so deep links don't 404 while their bespoke
 * editors are queued in the WP-8 backlog.
 *
 * `soaWizardSectionSchemas` is referenced so the import stays tree-
 * shake-resistant — adding a new bespoke editor will use the schema
 * here directly via the matching `useDraftSection` call.
 */
function SectionEditor(props: SectionEditorProps): ReactElement {
  void soaWizardSectionSchemas; // kept imported for the future per-section forms.
  const meta: SoaWizardSectionMeta =
    SOA_WIZARD_SECTION_META.find((s) => s.id === props.sectionId) ?? SOA_WIZARD_SECTION_META[0]!;
  const value = props.serverSections[props.sectionId];

  switch (props.sectionId) {
    case 'cover':
      return (
        <CoverEditor
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
        />
      );
    case 'aboutAuthority':
      return (
        <AboutAuthorityEditor
          serverValue={value}
          onSaveServer={async (parsed) => props.onSave(parsed)}
          isLocked={props.isLocked}
          clientId={props.clientId}
          clientDisplayName={props.clientDisplayName}
          factsBullets={props.factsBullets}
        />
      );
    default:
      return <PlaceholderEditor meta={meta} serverValue={value} />;
  }
}

/**
 * Mirror of the Fact Find page's helper — narrows the personal
 * section into a small bullet list the AI prompt sees as context.
 * Real `factsBullets` for the SOA Wizard will get richer once each
 * section's editor is built (e.g. include household.netWealth from
 * `position`); for now we re-use the FF helper.
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
