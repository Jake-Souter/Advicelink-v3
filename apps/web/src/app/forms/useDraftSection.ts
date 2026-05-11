import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ZodType, ZodTypeDef } from 'zod';

/**
 * `useDraftSection` — generic local-draft + Zod-validate + save hook
 * for one Fact Find section.
 *
 * The Fact Find UI never hits the wire on every keystroke; instead
 * each section keeps a local draft that the user explicitly saves.
 * On save the draft is parsed against the section's schema and (on
 * success) handed to the supplied `onSave` mutator. Validation
 * errors are surfaced as a flattened map so the route component can
 * paint per-field copy.
 *
 * `serverValue` is the canonical value from `factFind.loadByClientId`
 * — when it changes (after a successful save's invalidation, or a
 * cross-tab edit) the local draft re-syncs unless the user is in the
 * middle of editing (`isDirty`). That preserves in-flight edits
 * without ever displaying a stale copy.
 */
/**
 * The schema's input type may differ from its output (Zod
 * `default()` and `transform()` produce ZodEffects with distinct
 * `_input` and `_output` shapes). The hook works in OUTPUT-space:
 * `serverValue` is parsed → `T`, the draft is held as `T`, and the
 * `onSave` callback receives the parsed `T`. The third generic is
 * left as `unknown` so any Zod schema whose output is `T` plugs in
 * directly without callers having to widen the type.
 */
export interface UseDraftSectionOptions<T> {
  schema: ZodType<T, ZodTypeDef, unknown>;
  serverValue: unknown;
  onSave: (parsed: T) => Promise<unknown>;
}

export interface UseDraftSectionResult<T> {
  draft: T;
  setDraft: (next: T | ((prev: T) => T)) => void;
  reset: () => void;
  save: () => Promise<void>;
  errors: Record<string, string>;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  saveSuccessAt: Date | null;
}

export function useDraftSection<T>({
  schema,
  serverValue,
  onSave,
}: UseDraftSectionOptions<T>): UseDraftSectionResult<T> {
  // Parse the server payload through the schema so we always operate
  // on a structurally-correct draft even if the server bumped the
  // schema mid-session. Failure falls back to whatever the server
  // sent verbatim — the user will see validation errors but no
  // empty-screen.
  const parsedServer = useMemo<T>(() => {
    const result = schema.safeParse(serverValue);
    return result.success ? result.data : (serverValue as T);
  }, [schema, serverValue]);

  const [draft, setDraftState] = useState<T>(parsedServer);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessAt, setSaveSuccessAt] = useState<Date | null>(null);

  // Tracks whether the user has touched the draft since the last sync.
  // We flip this back to false on a fresh server payload OR a save.
  const isDirtyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync server → local when the user is idle.
  useEffect(() => {
    if (!isDirtyRef.current) {
      setDraftState(parsedServer);
    }
  }, [parsedServer]);

  const setDraft = useCallback((next: T | ((prev: T) => T)): void => {
    setDraftState((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next));
    isDirtyRef.current = true;
    setIsDirty(true);
    setErrors({});
    setSaveError(null);
  }, []);

  const reset = useCallback((): void => {
    setDraftState(parsedServer);
    isDirtyRef.current = false;
    setIsDirty(false);
    setErrors({});
    setSaveError(null);
  }, [parsedServer]);

  const save = useCallback(async (): Promise<void> => {
    const result = schema.safeParse(draft);
    if (!result.success) {
      const flat: Record<string, string> = {};
      for (const issue of result.error.issues) {
        flat[issue.path.join('.')] = issue.message;
      }
      setErrors(flat);
      return;
    }
    setErrors({});
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(result.data);
      setSaveSuccessAt(new Date());
      isDirtyRef.current = false;
      setIsDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [draft, onSave, schema]);

  return {
    draft,
    setDraft,
    reset,
    save,
    errors,
    isDirty,
    isSaving,
    saveError,
    saveSuccessAt,
  };
}
