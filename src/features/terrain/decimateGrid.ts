import type { DemBinaryGrid } from './demBinary';

/**
 * Load-time grid decimation for quality tiers.
 *
 * Keeps `floor((n - 1) / stride) + 1` samples per axis (the dimension formula
 * ADR-006 records for the three quality tiers) but places them with a
 * round-spread index map, `round(i * (n - 1) / (k - 1))`, so the first and
 * last row/column survive on every stride. Plain stride sampling would drop
 * the southern/eastern edge whenever `(n - 1) % stride !== 0`, and the
 * builder spans kept samples across the full declared extent — so dropping
 * the edge would silently show an interior sample at the terrain's border,
 * misregistering the mesh against the vector overlays that later units snap
 * into the same coordinate space. The round-spread keeps corners exact; the
 * interior jitter stays under half a source cell (15m at 30m).
 *
 * The elevation band is re-derived from the kept samples: a tier grid must
 * never carry a band that disagrees with its payload (the clamp failure in
 * ERR-008's fixture lesson). Readouts must therefore use the full-resolution
 * grid, not a decimated one.
 */
export function decimateGrid(grid: DemBinaryGrid, stride: number): DemBinaryGrid {
  if (!Number.isInteger(stride) || stride < 1) {
    throw new RangeError(
      `decimateGrid stride must be an integer >= 1, received ${stride}`,
    );
  }

  const keptIndices = (length: number): number[] => {
    const kept = Math.min(length, Math.max(2, Math.floor((length - 1) / stride) + 1));
    if (kept === length) {
      return Array.from({ length }, (_, i) => i);
    }
    return Array.from({ length: kept }, (_, i) =>
      Math.round((i * (length - 1)) / (kept - 1)),
    );
  };

  const rowIndices = keptIndices(grid.rows);
  const colIndices = keptIndices(grid.cols);

  const samples = new Float32Array(rowIndices.length * colIndices.length);
  for (let row = 0; row < rowIndices.length; row += 1) {
    for (let col = 0; col < colIndices.length; col += 1) {
      samples[row * colIndices.length + col] =
        grid.samples[rowIndices[row] * grid.cols + colIndices[col]];
    }
  }

  return {
    samples,
    rows: rowIndices.length,
    cols: colIndices.length,
    widthMeters: grid.widthMeters,
    depthMeters: grid.depthMeters,
    minElevationMeters: Math.min(...samples),
    maxElevationMeters: Math.max(...samples),
  };
}
