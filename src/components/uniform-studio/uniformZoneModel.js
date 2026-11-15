/**
 * Editable vector trace for the approved soccer source image.
 *
 * Coordinates are local to one half of the 1159 × 1358 front/back sprite.
 * Every curved edge is stored as a cubic Bézier command so the correction
 * editor can expose both anchors and tangent handles without parsing a path
 * string.  The original raster remains below these masks and supplies fabric
 * folds, stitching, highlights and mesh texture.
 */

const M = (x, y) => ({ type: "M", x, y });
const C = (c1x, c1y, c2x, c2y, x, y) => ({ type: "C", c1x, c1y, c2x, c2y, x, y });

const zone = (id, name, colorKey, commands, group, notes = "") => ({
  id,
  name,
  colorKey,
  commands,
  group,
  notes,
  verified: true,
});

const front = [
  zone("front-body", "Jersey front body", "body", [
    M(278, 58), C(294, 70, 311, 90, 333, 116), C(355, 90, 373, 70, 391, 58),
    C(423, 78, 444, 104, 455, 136), C(466, 180, 469, 260, 467, 340),
    C(466, 420, 477, 487, 481, 545), C(410, 552, 255, 552, 189, 545),
    C(191, 480, 194, 409, 195, 338), C(194, 256, 198, 177, 210, 135),
    C(222, 103, 246, 76, 278, 58),
  ], "Jersey"),
  zone("front-left-shoulder", "Front left shoulder and sleeve", "sleeve", [
    M(278, 42), C(244, 45, 211, 62, 183, 83), C(145, 112, 128, 152, 119, 191),
    C(113, 215, 108, 238, 106, 258), C(133, 269, 164, 274, 195, 274),
    C(197, 225, 199, 176, 210, 135), C(222, 102, 246, 70, 278, 54),
  ], "Jersey"),
  zone("front-right-shoulder", "Front right shoulder and sleeve", "sleeve", [
    M(391, 42), C(424, 47, 455, 62, 483, 84), C(520, 113, 539, 151, 548, 192),
    C(553, 215, 558, 238, 560, 258), C(532, 269, 502, 274, 472, 274),
    C(469, 225, 466, 176, 455, 135), C(443, 102, 420, 70, 391, 54),
  ], "Jersey"),
  zone("front-collar", "Front neckline and collar trim", "collar", [
    M(275, 55), C(287, 35, 304, 25, 333, 25), C(362, 25, 380, 35, 393, 55),
    C(380, 78, 360, 102, 333, 118), C(306, 101, 286, 79, 275, 55),
  ], "Trims"),
  zone("front-left-armhole", "Front left raglan seam", "armhole", [
    M(272, 61), C(246, 76, 222, 104, 210, 136), C(201, 169, 198, 211, 197, 254),
    C(203, 211, 207, 171, 218, 140), C(230, 110, 251, 85, 280, 68),
  ], "Seams"),
  zone("front-right-armhole", "Front right raglan seam", "armhole", [
    M(394, 61), C(421, 76, 443, 104, 455, 136), C(465, 170, 469, 211, 470, 254),
    C(463, 211, 459, 171, 447, 140), C(436, 110, 415, 85, 386, 68),
  ], "Seams"),
  zone("front-left-cuff", "Front left sleeve end", "sleeveStrip", [
    M(106, 242), C(133, 251, 165, 255, 198, 253), C(198, 260, 197, 267, 195, 274),
    C(161, 276, 131, 270, 106, 260), C(105, 253, 105, 247, 106, 242),
  ], "Trims"),
  zone("front-right-cuff", "Front right sleeve end", "sleeveStrip", [
    M(469, 253), C(501, 255, 532, 251, 560, 242), C(561, 248, 561, 254, 560, 260),
    C(535, 270, 504, 276, 472, 274), C(470, 267, 469, 260, 469, 253),
  ], "Trims"),
  zone("front-shirt-hem", "Front jersey bottom hem", "shirtStrip", [
    M(189, 540), C(260, 545, 411, 545, 481, 540), C(483, 548, 484, 557, 484, 566),
    C(411, 571, 258, 571, 185, 566), C(186, 557, 187, 548, 189, 540),
  ], "Trims"),
  zone("front-waistband", "Front shorts waistband", "waistband", [
    M(177, 558), C(247, 570, 416, 570, 485, 558), C(487, 571, 489, 584, 490, 596),
    C(413, 607, 249, 607, 172, 596), C(173, 583, 175, 570, 177, 558),
  ], "Shorts"),
  zone("front-left-shorts", "Front left shorts leg", "shorts", [
    M(173, 589), C(214, 600, 274, 602, 331, 600), C(331, 646, 323, 706, 306, 814),
    C(264, 829, 211, 829, 163, 812), C(164, 733, 166, 655, 173, 589),
  ], "Shorts"),
  zone("front-right-shorts", "Front right shorts leg", "shorts", [
    M(331, 600), C(389, 602, 449, 600, 490, 589), C(497, 655, 499, 733, 500, 812),
    C(452, 829, 399, 829, 357, 814), C(340, 706, 332, 646, 331, 600),
  ], "Shorts"),
  zone("front-left-shorts-hem", "Front left shorts hem", "shortsStrip", [
    M(163, 806), C(209, 822, 262, 822, 306, 808), C(305, 819, 304, 829, 303, 839),
    C(258, 853, 207, 853, 163, 838), C(163, 827, 163, 817, 163, 806),
  ], "Trims"),
  zone("front-right-shorts-hem", "Front right shorts hem", "shortsStrip", [
    M(357, 808), C(401, 822, 454, 822, 500, 806), C(500, 817, 500, 827, 500, 838),
    C(456, 853, 405, 853, 360, 839), C(359, 829, 358, 819, 357, 808),
  ], "Trims"),
  zone("front-left-sock", "Front left sock", "socks", [
    M(163, 889), C(188, 880, 221, 886, 231, 904), C(237, 997, 225, 1096, 210, 1194),
    C(222, 1240, 215, 1308, 177, 1330), C(141, 1326, 130, 1285, 142, 1213),
    C(151, 1104, 143, 978, 163, 889),
  ], "Socks"),
  zone("front-right-sock", "Front right sock", "socks", [
    M(403, 904), C(414, 886, 447, 880, 472, 889), C(492, 978, 484, 1104, 493, 1213),
    C(505, 1285, 494, 1326, 458, 1330), C(420, 1308, 413, 1240, 425, 1194),
    C(410, 1096, 398, 997, 403, 904),
  ], "Socks"),
  zone("front-left-sock-cuff", "Front left sock cuff", "socks", [
    M(163, 889), C(185, 880, 211, 883, 231, 904), C(232, 924, 232, 943, 231, 961),
    C(207, 949, 180, 947, 155, 960), C(156, 934, 158, 910, 163, 889),
  ], "Trims"),
  zone("front-right-sock-cuff", "Front right sock cuff", "socks", [
    M(403, 904), C(423, 883, 449, 880, 472, 889), C(477, 910, 479, 934, 480, 960),
    C(455, 947, 428, 949, 404, 961), C(403, 943, 402, 924, 403, 904),
  ], "Trims"),
];

const back = front.map((item) => {
  const shift = -76;
  const commands = item.commands.map((command) => ({
    ...command,
    x: command.x + shift,
    ...(command.type === "C" ? { c1x: command.c1x + shift, c2x: command.c2x + shift } : {}),
  }));
  return {
    ...item,
    id: item.id.replace("front", "back"),
    name: item.name.replace("Front", "Back"),
    commands,
    notes: "Back view is independently editable.",
  };
});

export const SOCCER_ZONE_MODEL = { front, back };

export const NO_DETECTED_SOURCE_ELEMENTS = [
  "Printed logos", "Jersey numbers", "Lettering", "Sponsor graphics",
  "Decorative printed patterns", "Drawstrings", "Distinct side inserts",
];

export function commandsToPath(commands, offsetX = 0) {
  const parts = commands.map((command) => {
    if (command.type === "M") return `M ${command.x + offsetX} ${command.y}`;
    return `C ${command.c1x + offsetX} ${command.c1y} ${command.c2x + offsetX} ${command.c2y} ${command.x + offsetX} ${command.y}`;
  });
  return `${parts.join(" ")} Z`;
}

export function cloneZoneModel(model = SOCCER_ZONE_MODEL) {
  return Object.fromEntries(Object.entries(model).map(([view, zones]) => [
    view,
    zones.map((item) => ({ ...item, commands: item.commands.map((command) => ({ ...command })) })),
  ]));
}

export function zoneValidation(zones) {
  const seen = new Set();
  return zones.map((item) => {
    const issues = [];
    if (seen.has(item.id)) issues.push("Duplicate ID");
    seen.add(item.id);
    if (!item.commands?.length || item.commands[0]?.type !== "M") issues.push("Incomplete path");
    if ((item.commands || []).length < 3) issues.push("Too few boundary segments");
    return { id: item.id, issues };
  }).filter((entry) => entry.issues.length);
}

export function zoneOverlapWarnings(zones) {
  const editableFabric = zones.filter((item) => !["Trims", "Seams"].includes(item.group));
  const bounds = (item) => {
    const points = item.commands.flatMap((command) => command.type === "C"
      ? [[command.x, command.y], [command.c1x, command.c1y], [command.c2x, command.c2y]]
      : [[command.x, command.y]]);
    return {
      minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)),
      minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)),
    };
  };
  const warnings = [];
  editableFabric.forEach((a, index) => editableFabric.slice(index + 1).forEach((b) => {
    // Adjacent construction zones (body/sleeve, waistband/legs) intentionally
    // share a seam envelope. Only two regions claiming the same material role
    // are treated as an accidental overlap.
    if (a.group !== b.group || a.colorKey !== b.colorKey) return;
    const aa = bounds(a);
    const bb = bounds(b);
    const width = Math.max(0, Math.min(aa.maxX, bb.maxX) - Math.max(aa.minX, bb.minX));
    const height = Math.max(0, Math.min(aa.maxY, bb.maxY) - Math.max(aa.minY, bb.minY));
    const overlap = width * height;
    const smaller = Math.min((aa.maxX - aa.minX) * (aa.maxY - aa.minY), (bb.maxX - bb.minX) * (bb.maxY - bb.minY));
    if (smaller && overlap / smaller > 0.18) warnings.push({ ids: [a.id, b.id], ratio: overlap / smaller });
  }));
  return warnings;
}
