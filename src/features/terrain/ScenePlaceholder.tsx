/**
 * Placeholder shown until the terrain heightfield unit lands.
 *
 * The product must never present an empty black canvas as if it were the tool
 * (ADR-002), so this states plainly what is missing and what replaces it.
 */
export function ScenePlaceholder() {
  return (
    <section
      data-testid="scene-placeholder"
      aria-labelledby="scene-placeholder-heading"
      className="grid min-h-[60dvh] place-items-center p-6"
    >
      <div className="max-w-prose space-y-3 text-center">
        <h2
          id="scene-placeholder-heading"
          className="text-base font-medium text-text-secondary"
        >
          3D terrain not yet built
        </h2>
        <p className="text-sm text-text-secondary">
          This unit builds Kampala&rsquo;s elevation model from Copernicus DEM GLO-30.
          Until it lands, the flood risk data is not yet reachable here.
        </p>
        <p className="text-sm text-text-secondary">
          The accessible 2D depth view arrives with the flood extent classes and will
          remain available regardless of 3D support.
        </p>
      </div>
    </section>
  );
}
