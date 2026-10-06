/**
 * Honest fallback for devices and browsers without WebGL2 (ADR-002).
 *
 * The product must never present an empty black canvas as if it were the tool,
 * so this states plainly why the scene is absent and where the accessible
 * path arrives.
 */
export function SceneFallback() {
  return (
    <section
      data-testid="scene-fallback"
      aria-labelledby="scene-fallback-heading"
      className="grid min-h-[60dvh] place-items-center p-6"
    >
      <div className="max-w-prose space-y-3 text-center">
        <h2
          id="scene-fallback-heading"
          className="text-base font-medium text-text-secondary"
        >
          3D terrain unavailable in this browser
        </h2>
        <p className="text-sm text-text-secondary">
          Ombros renders Kampala&rsquo;s terrain in 3D, which needs WebGL2. This device or
          browser cannot provide it, so the scene is withheld rather than shown as a blank
          canvas.
        </p>
        <p className="text-sm text-text-secondary">
          The accessible 2D depth view arrives with the flood extent classes and will
          remain available regardless of 3D support.
        </p>
      </div>
    </section>
  );
}
