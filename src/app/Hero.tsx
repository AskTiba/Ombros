import type { ReactNode } from 'react';

/**
 * First-run orientation band (Unit C).
 *
 * A first-time visitor — including the project's own owner — previously hit a
 * bare map and insider jargon with nothing explaining what the tool was for.
 * This states the value proposition first, names the concrete actions, and
 * gives an ordered starting path so the screen explains itself before any data
 * is read. Leading with the decision capability, not the rendering (RISK-006).
 */

const STEPS = [
  {
    title: 'Read the map',
    body: 'Each dot is one flood location. Darker blue means deeper water.',
  },
  {
    title: 'Check the numbers',
    body: 'See the risk at a glance, then pick a sub-county to drill into its numbers.',
  },
  {
    title: 'Export the report',
    body: 'Download the findings as a report you can share with your team.',
  },
] as const;

export function Hero(): ReactNode {
  return (
    <section aria-labelledby="hero-heading" className="space-y-5">
      <div className="space-y-3">
        <h2
          id="hero-heading"
          className="text-xl font-semibold tracking-tight text-balance"
        >
          See where Kampala floods — and how deep.
        </h2>
        <p className="max-w-prose text-text-secondary">
          Ombros turns peer-reviewed flood science into a tool you can use: explore a
          modelled rainfall scenario, find which locations go under, pick a sub-county for
          its numbers, and export a decision-ready report for planners, insurers, and
          developers.
        </p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-lg border border-border bg-surface-raised p-4"
          >
            <span
              aria-hidden="true"
              className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-surface-base"
            >
              {index + 1}
            </span>
            <p className="font-medium">{step.title}</p>
            <p className="text-sm text-text-secondary">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
