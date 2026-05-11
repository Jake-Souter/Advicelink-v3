import { createFileRoute } from '@tanstack/react-router';
import { Stack } from '@advicelink/ui';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  // Foundation placeholder. Real landing routes (login, portal redirect) land
  // in Work Package 3 (Auth + tRPC). Visual styling for the splash lives in
  // the global stylesheet via the `data-page="splash"` attribute, keeping
  // this route file pure layout composition (REBUILD_PLAN §11.6.1).
  return (
    <Stack gap={4} align="center" data-page="splash">
      <img src="/ready-advice-logo.png" alt="Ready Advice" width={320} />
      <p>Advicelink v3 foundations are running.</p>
    </Stack>
  );
}
