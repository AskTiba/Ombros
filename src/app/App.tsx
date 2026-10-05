import { ScenePlaceholder } from '@/features/terrain/ScenePlaceholder';

export function App() {
  return (
    <main className="min-h-dvh bg-surface-base text-text-primary">
      <header className="border-b border-white/10 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Ombros</h1>
        <p className="text-sm text-text-secondary">Flood risk intelligence for Kampala</p>
      </header>
      <ScenePlaceholder />
    </main>
  );
}
