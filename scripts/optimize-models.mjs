/**
 * Decimate + Draco-compress GLB garment models for the 3D configurator.
 *
 * Raw Rodin/scan exports land around 30 MB and 340k vertices. That's a
 * punishing first load, and — more importantly — decal projection
 * (DecalGeometry) walks every triangle in the target mesh, so a heavy model
 * makes dragging a logo across the garment feel sludgy. Decimating to ~100k
 * verts and Draco-compressing gets both under control with no visible
 * quality loss at configurator viewing distance.
 *
 * Originals in public/models/ are never modified; optimised copies are
 * written to public/models/opt/, which is what the app actually loads (see
 * `sports[].modelUrl` in src/data/uniforms.js).
 *
 * Usage, from the repo root:
 *   npm install --no-save @gltf-transform/core @gltf-transform/extensions \
 *     @gltf-transform/functions meshoptimizer draco3dgltf sharp
 *   node scripts/optimize-models.mjs
 *   node scripts/optimize-models.mjs my-new-model.glb   # just one
 *
 * RATIO is the simplifier's target fraction of original vertices. Meshopt
 * treats it as a target, not a guarantee — it refuses to collapse edges that
 * would exceed the error bound, so 0.12 lands nearer 0.28 on these scans.
 * Lower it if files are still too big; raise it if silhouettes get lumpy.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { simplify, weld, dedup, prune, textureCompress, draco } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import draco3d from "draco3dgltf";
import sharp from "sharp";
import { readdirSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RATIO = 0.12;
const MAX_TEXTURE = 2048;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "public", "models");
const OUT = join(SRC, "opt");

const countVerts = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getAttribute("POSITION")?.getCount() ?? 0), 0);

const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(2);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.encoder": await draco3d.createEncoderModule(),
  "draco3d.decoder": await draco3d.createDecoderModule(),
});

await MeshoptSimplifier.ready;
mkdirSync(OUT, { recursive: true });

const only = process.argv[2];
const files = only
  ? [only]
  : readdirSync(SRC).filter((f) => f.toLowerCase().endsWith(".glb"));

if (!files.length) {
  console.error(`No .glb files found in ${SRC}`);
  process.exit(1);
}

for (const file of files) {
  const inPath = join(SRC, file);
  const outPath = join(OUT, file);

  const doc = await io.read(inPath);
  const before = countVerts(doc);

  await doc.transform(
    dedup(),
    // Merge coincident vertices first — scan exports are often fully
    // unwelded, and the simplifier can't collapse an edge whose endpoints
    // it doesn't know are shared.
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.001, lockBorder: false }),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [MAX_TEXTURE, MAX_TEXTURE] }),
    draco(),
  );

  const after = countVerts(doc);
  await io.write(outPath, doc);

  console.log(
    `${file}\n` +
      `   ${mb(inPath)} MB -> ${mb(outPath)} MB` +
      `   |   ${before.toLocaleString()} -> ${after.toLocaleString()} verts` +
      ` (${((100 * after) / before).toFixed(0)}%)`,
  );
}

console.log(`\nWrote ${files.length} file(s) to public/models/opt/`);
console.log("Point sports[].modelUrl in src/data/uniforms.js at /models/opt/<file>.glb");
