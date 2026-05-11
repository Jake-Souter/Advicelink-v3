import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

import { env } from '../config/env.js';

/**
 * Apply every `migrations/NNNN_*.sql` in lexical order, exactly once,
 * recording each in `_advicelink_migrations` with a SHA-256 of the file
 * content so drift (someone editing an applied migration) becomes a
 * loud, abort-the-deploy error rather than silent inconsistency.
 *
 * Running:  pnpm --filter @advicelink/db db:migrate
 *           (must be wrapped in `doppler run` so DATABASE_URL is set)
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', 'migrations');

interface MigrationRow {
  id: string;
  checksum: string;
}

async function main(): Promise<void> {
  const sql = postgres(env.DATABASE_URL, {
    max: 1,
    ssl: env.DATABASE_SSL === 'false' ? false : env.DATABASE_SSL,
    connect_timeout: 15,
    idle_timeout: 5,
    connection: { application_name: 'advicelink-migrate' },
    prepare: false,
    // Silence "relation already exists, skipping" NOTICEs from CREATE TABLE
    // IF NOT EXISTS — useful in CI logs but visually noisy on rerun.
    onnotice: () => {},
  });

  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS _advicelink_migrations (
        id          text        PRIMARY KEY,
        checksum    text        NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      );
    `);

    const files = (await readdir(migrationsDir)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();

    if (files.length === 0) {
      console.log('No migrations found in', migrationsDir);
      return;
    }

    const applied = await sql<MigrationRow[]>`SELECT id, checksum FROM _advicelink_migrations`;
    const appliedById = new Map(applied.map((row) => [row.id, row.checksum]));

    for (const file of files) {
      const fullPath = join(migrationsDir, file);
      const content = await readFile(fullPath, 'utf8');
      const checksum = createHash('sha256').update(content).digest('hex');
      const previous = appliedById.get(file);

      if (previous) {
        if (previous !== checksum) {
          throw new Error(
            `Migration drift: ${file} was applied with checksum ${previous} but the file ` +
              `now hashes to ${checksum}. Migrations are immutable — author a new file ` +
              `instead of editing this one.`,
          );
        }
        console.log(`✓ ${file} (already applied)`);
        continue;
      }

      console.log(`→ ${file} applying...`);
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`
          INSERT INTO _advicelink_migrations (id, checksum)
          VALUES (${file}, ${checksum})
        `;
      });
      console.log(`✓ ${file} applied (sha256 ${checksum.slice(0, 12)})`);
    }

    console.log('Migrations complete.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
