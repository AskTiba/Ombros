/**
 * Resampling the Copernicus GLO-30 raster onto the uniform terrain grid.
 *
 * ## Why this is a module and not script-local code
 *
 * `scripts/fetch-dem.mjs` is a one-time data-acquisition step: it touches the
 * network and writes a gitignored file, so almost none of it can be unit
 * tested. The part that *can* be — deriving the grid dimensions and sampling
 * the source raster — is where every interesting failure mode lives. A
 * transposed resample, an off-by-one window, or a north-up/south-up mix-up all
 * produce a plausible-looking terrain mesh and no error anywhere. So the
 * geometry lives here, in the same module boundary as the decoder and the
 * builder, and the script is left holding only network and filesystem work.
 *
 * ## Verified facts about the source raster
 *
 * Read from the live COG header, not assumed:
 *
 * - `Copernicus_DSM_COG_10_N00_00_E032_00_DEM` covers **32–33°E, 0–1°N**, so it
 *   does contain the study extent (32.511–32.684°E, 0.207–0.409°N).
 * - Samples are **float32**, EGM2008 geoid heights.
 * - Compression is **Deflate with a floating-point predictor (3)**, tiled
 *   1024×1024. Hand-decoding that is not reasonable, which is why the script
 *   uses `geotiff` rather than a bespoke TIFF reader.
 * - The grid is **1 arcsecond**, which is *not* 30m. At this latitude one cell
 *   is ~30.71m north-south and ~30.92m east-west. The published "30m" is a
 *   nominal rounded figure, and the difference is disclosed rather than hidden
 *   (RISK-007) — it bounds how much detail any terrain-derived claim can carry.
 *
 * ## The half-cell asymmetry this has to respect
 *
 * 1 arcsecond is a fixed step in *degrees*, so on the ellipsoid it is ~30.71m
 * of latitude but ~30.92m of longitude at 0.3°N. The source is therefore
 * genuinely anisotropic in metres. The target grid is deliberately isotropic
 * (ADR-006) because every measurement taken off the terrain depends on uniform
 * cells, so this module resamples a slightly coarser east-west axis onto a
 * slightly finer uniform cell rather than assuming the two line up.
 *
 * The resample is a ~3% stretch, so bilinear is used: it blends only adjacent
 * ~30m source cells and cannot invent a feature that is not there, while
 * nearest-neighbour would terrace the terrain into visible 30m steps along the
 * axis that is being stretched.
 */

/** Nominal target cell size. See the note on 1 arcsecond above before changing. */
export const DEM_CELL_SIZE_METERS = 30;

/**
 * The geographic and metric footprint the grid has to cover.
 *
 * Passed in rather than imported so this module stays free of any single
 * city's constants — and so `scripts/fetch-dem.mjs` can remain the one place
 * that composes `geo.ts` with this module. Importing `geo.ts` from here would
 * need an explicit `.ts` extension for Node's ESM loader to resolve it under
 * native type stripping, which is a build-config change to accommodate a
 * dependency that is better expressed as an argument.
 */
export interface StudyExtent {
  west: number;
  east: number;
  south: number;
  north: number;
  /** East-west span in metres, from `boundsWidthMeters()`. */
  widthMeters: number;
  /** North-south span in metres, from `boundsHeightMeters()`. */
  depthMeters: number;
}

export interface DemGridSpec {
  cols: number;
  rows: number;
  /** East-west span, in metres. Matches `boundsWidthMeters()` by construction. */
  widthMeters: number;
  /** North-south span, in metres. Matches `boundsHeightMeters()` by construction. */
  depthMeters: number;
}

/**
 * Derives the target grid dimensions from a metre extent.
 *
 * `+ 1` because `cols` counts vertices, not cells: an extent of `n` cells has
 * `n + 1` grid lines. Forgetting it drops the last row and column of terrain,
 * which is invisible in a wireframe and wrong in every measurement.
 *
 * The resulting cells are uniform but not exactly 30m — integer rounding leaves
 * a little drift. That invariant is enforced by `buildHeightfieldGeometry`
 * (ADR-006); it is deliberately not re-asserted here, because a duplicated
 * tolerance is a second place to keep in sync. `demResample.test.ts` pins the
 * actual drift so a change that breaks uniformity fails a test.
 */
export function computeDemGrid(
  widthMeters: number,
  depthMeters: number,
  cellSizeMeters: number = DEM_CELL_SIZE_METERS,
): DemGridSpec {
  if (!Number.isFinite(widthMeters) || widthMeters <= 0) {
    throw new Error(
      `DEM grid width must be positive and finite, received ${widthMeters}`,
    );
  }
  if (!Number.isFinite(depthMeters) || depthMeters <= 0) {
    throw new Error(
      `DEM grid depth must be positive and finite, received ${depthMeters}`,
    );
  }
  if (!Number.isFinite(cellSizeMeters) || cellSizeMeters <= 0) {
    throw new Error(
      `DEM grid cell size must be positive and finite, received ${cellSizeMeters}`,
    );
  }

  return {
    cols: Math.round(widthMeters / cellSizeMeters) + 1,
    rows: Math.round(depthMeters / cellSizeMeters) + 1,
    widthMeters,
    depthMeters,
  };
}

/** WGS84 metres-per-degree helpers, inlined rather than imported. Same formulas
 * as `geo.ts`; see that module for the derivation and the error analysis. */
const metresPerDegreeLatitude = (lat: number): number => {
  const a = 6_378_137.0;
  const f = 1 / 298.257223563;
  const e2 = 2 * f - f * f;
  const rad = (lat * Math.PI) / 180;
  const sin = Math.sin(rad);
  return (((a * (1 - e2)) / Math.pow(1 - e2 * sin * sin, 1.5)) * Math.PI) / 180;
};

const metresPerDegreeLongitude = (lat: number): number => {
  const a = 6_378_137.0;
  const f = 1 / 298.257223563;
  const e2 = 2 * f - f * f;
  const rad = (lat * Math.PI) / 180;
  const sin = Math.sin(rad);
  return ((a / Math.sqrt(1 - e2 * sin * sin)) * Math.cos(rad) * Math.PI) / 180;
};

/** Georeferencing of a source raster window, in degrees. */
export interface SourceWindowGeo {
  /** Longitude of the **centre** of window pixel (0, 0). */
  originLon: number;
  /** Latitude of the **centre** of window pixel (0, 0). */
  originLat: number;
  /** Degrees per pixel. 1 arcsecond = 1 / 3600. */
  pixelSizeDegrees: number;
  cols: number;
  rows: number;
}

/**
 * Inverse of the bounds helpers, deliberately.
 *
 * `boundsWidthMeters()` scales a longitude span by `metresPerDegreeLongitude`
 * at the mid-latitude, so the reverse step divides by the same factor. Deriving
 * the forward and reverse scales independently is how a terrain ends up a few
 * hundred metres from where its own header says it is.
 */
const targetVertexToLonLat = (
  col: number,
  row: number,
  spec: DemGridSpec,
  extent: StudyExtent,
) => {
  // Steps come from the *spec*, not from `extent`: the spec owns the geometry
  // (how many vertices, spanning how many metres), while the extent only
  // supplies the anchor point and the latitude to evaluate the WGS84 scale at.
  // Taking the step from the extent while taking the vertex count from the spec
  // means the two must agree exactly, which is a constraint no caller can see
  // and any future caller with a different footprint would silently violate.
  const stepX = spec.widthMeters / (spec.cols - 1);
  const stepZ = spec.depthMeters / (spec.rows - 1);
  const midLatitude = (extent.north + extent.south) / 2;

  const eastMeters = col * stepX;
  // Row 0 is north, so the northward offset shrinks with the row index.
  const northMeters = (spec.rows - 1 - row) * stepZ;

  return {
    lon: extent.west + eastMeters / metresPerDegreeLongitude(midLatitude),
    lat: extent.south + northMeters / metresPerDegreeLatitude(midLatitude),
  };
};

/** Fractional source-raster pixel coordinates of one target vertex. */
export const targetVertexToSourcePixel = (
  col: number,
  row: number,
  spec: DemGridSpec,
  extent: StudyExtent,
  geo: SourceWindowGeo,
): { px: number; py: number } => {
  const { lon, lat } = targetVertexToLonLat(col, row, spec, extent);
  return {
    px: (lon - geo.originLon) / geo.pixelSizeDegrees,
    // Raster rows run south from the origin, so latitude decreases downward.
    py: (geo.originLat - lat) / geo.pixelSizeDegrees,
  };
};

/**
 * Integer source-pixel window covering the study extent, with a 1-pixel margin.
 *
 * The margin matters: bilinear interpolation reads the four pixels around the
 * sample point, so a window cropped exactly to the extent would clamp
 * interpolation against the boundary and flatten the terrain along the whole
 * western and southern edge — a visible artefact with no error thrown.
 */
export function computeSourceWindow(
  spec: DemGridSpec,
  extent: StudyExtent,
  geo: Pick<SourceWindowGeo, 'originLon' | 'originLat' | 'pixelSizeDegrees'>,
  imageWidth: number,
  imageHeight: number,
): { left: number; top: number; width: number; height: number } {
  const corners: Array<[number, number]> = [
    [0, 0],
    [spec.cols - 1, 0],
    [0, spec.rows - 1],
    [spec.cols - 1, spec.rows - 1],
  ];

  let minPx = Infinity;
  let maxPx = -Infinity;
  let minPy = Infinity;
  let maxPy = -Infinity;
  for (const [col, row] of corners) {
    const { px, py } = targetVertexToSourcePixel(col, row, spec, extent, {
      ...geo,
      cols: 0,
      rows: 0,
    });
    minPx = Math.min(minPx, px);
    maxPx = Math.max(maxPx, px);
    minPy = Math.min(minPy, py);
    maxPy = Math.max(maxPy, py);
  }

  const left = Math.max(0, Math.floor(minPx) - 1);
  const top = Math.max(0, Math.floor(minPy) - 1);
  // `ceil` then `+ 1` so the pixel containing maxPx is fully inside the window.
  const right = Math.min(imageWidth, Math.ceil(maxPx) + 1);
  const bottom = Math.min(imageHeight, Math.ceil(maxPy) + 1);

  if (right <= left || bottom <= top) {
    throw new Error(
      `DEM source window is empty: study extent maps outside the raster (x ${left}..${right}, y ${top}..${bottom} of ${imageWidth}x${imageHeight})`,
    );
  }

  return { left, top, width: right - left, height: bottom - top };
}

const bilinearAt = (
  window: Float32Array,
  width: number,
  height: number,
  px: number,
  py: number,
): number => {
  // Clamping the coordinate (rather than the resulting index) means an
  // out-of-window sample degrades to the nearest edge value instead of reading
  // a different row.
  const cx = Math.min(Math.max(px, 0), width - 1);
  const cy = Math.min(Math.max(py, 0), height - 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = cx - x0;
  const fy = cy - y0;

  const v00 = window[y0 * width + x0];
  const v10 = window[y0 * width + x1];
  const v01 = window[y1 * width + x0];
  const v11 = window[y1 * width + x1];

  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fy;
};

/**
 * Resamples a source raster window onto the uniform target grid.
 *
 * Returns row-major elevations in metres with row 0 at the **north** edge,
 * matching `readDemBinary` and `buildHeightfieldGeometry` (ADR-005).
 *
 * @param window Source samples, row-major from its own top-left corner.
 * @param geo Georeferencing **of the window**, not of the source image. The
 * script shifts the origin by the window's `left`/`top` before calling, so
 * forgetting that shift silently displaces the terrain by up to 15km.
 */
export function resampleWindowToGrid(
  window: Float32Array,
  geo: SourceWindowGeo,
  spec: DemGridSpec,
  extent: StudyExtent,
): Float32Array {
  if (window.length !== geo.cols * geo.rows) {
    throw new Error(
      `DEM source window holds ${window.length} samples but its georeferencing describes ${geo.cols * geo.rows}`,
    );
  }

  const out = new Float32Array(spec.rows * spec.cols);
  for (let row = 0; row < spec.rows; row += 1) {
    for (let col = 0; col < spec.cols; col += 1) {
      const { px, py } = targetVertexToSourcePixel(col, row, spec, extent, geo);
      out[row * spec.cols + col] = bilinearAt(window, geo.cols, geo.rows, px, py);
    }
  }
  return out;
}
