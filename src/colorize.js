// 把真實 Z-Anatomy 腦 mesh 依名稱關鍵字分到區域，套用區域顏色。
// 規則表的順序很重要 — 先比對較具體的關鍵字（如 hippocampus）再比對較廣的（如 temporal）。

// 順序很重要：深部 → 後/側皮質 → 額葉。
// 注意 parietal 比 occipital 早（precuneus 含 cuneus），temporal 比 occipital 早
// （occipitotemporal 同時含 occipital 與 temporal，應算 temporal）。
const REGION_PATTERNS = [
  // ── 深部結構（subcortical）
  { system: 'limbic', keywords: [
    'amygdal', 'hippocampus', 'hypothalamus', 'thalamus', 'thalami',
    'mammillary', 'mamillary', 'fornix', 'septal', 'olfactory_tubercle',
    'parahippocampal', 'subiculum', 'habenula', 'geniculate_body',
    'optic_chiasm', 'diencephalon', 'caudate', 'putamen', 'pallidus',
    'lentiform', 'optic_tract', 'corpus_striatum',
  ]},
  { system: 'brainstem', keywords: [
    'midbrain', 'mesencephal', 'pons', 'ponti', 'medulla',
    'tegmentum', 'aqueduct', 'brainstem', 'tectum',
    'cerebral_peduncle', 'base_of_peduncle', 'colliculus', 'reticular',
    'substantia_nigra', 'red_nucleus', 'olive', 'pyramid_of_medulla',
    'oculomotor', 'trochlear', 'trigeminal', 'abducens',
    'cochlear_nucleus', 'vestibular', 'salivatory', 'vagus',
    'hypoglossal', 'fourth_ventricle', 'interpeduncular',
    'solitary_tract', 'ambiguus', 'facial_nerve', 'glossopharyngeal',
    'posterior_commissure',
  ]},
  { system: 'cerebellum', keywords: [
    'cerebellum', 'cerebellar', 'vermis', 'tonsil_of_cerebellum',
    'flocc', 'culmen', 'declive', 'folium', 'nodulus', 'arbor_vitae',
    'uvula', 'quadrangular_lobule', 'biventral_lobule',
    'gracile_lobule', 'semilunar_lobule', 'wing_of_central_lobule',
  ]},

  // ── 大腦皮質葉
  { system: 'parietal', keywords: [
    'parietal', 'postcentral', 'angular_gyrus', 'precuneus',
    'supramarginal',
  ]},
  { system: 'temporal', keywords: [
    'temporal', 'fusiform', 'heschl', 'planum', 'lat_fis', 'insula',
  ]},
  { system: 'occipital', keywords: [
    'occipital', 'calcarine', 'lingual_gyrus', 'cuneus',
  ]},
  { system: 'frontal', keywords: [
    'frontal', 'precentral', 'olfactory_sulcus', 'cingulate',
    'orbital_part', 'orbital_gyri', 'orbital_sulci', 'frontomarginal',
    'frontopolar', 'paracentral', 'gyrus_rectus', 'operculum',
  ]},
];

export function classifyMeshName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const { system, keywords } of REGION_PATTERNS) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return system;
    }
  }
  return null;
}

export function colorizeBrain(root, systemColors, { fallbackColor = 0xd8cfc0 } = {}) {
  const counts = {};
  const unmatchedSamples = [];
  let totalMesh = 0;
  root.traverse(o => {
    if (!o.isMesh) return;
    totalMesh++;
    if (o.userData.isMarker || o.userData.isOverlay) return;
    if (!o.material) return;
    const region = classifyMeshName(o.name);
    const color = (region && systemColors[region]) || fallbackColor;
    counts[region ?? 'unmatched'] = (counts[region ?? 'unmatched'] || 0) + 1;
    if (!region && unmatchedSamples.length < 6) unmatchedSamples.push(o.name);

    // Clone material to avoid sharing across meshes (Z-Anatomy 部分 mesh 共用 material).
    // 同時把可能蓋過 base color 的貼圖清掉（Z-Anatomy 不一定有，但保險）。
    const cloneOne = (m) => {
      const c = m.clone();
      c.color.setHex(color);
      // Kill base-color texture / emissive map so our tint actually shows
      if (c.map)         { c.map = null; }
      if (c.emissiveMap) { c.emissiveMap = null; }
      if (c.emissive)    { c.emissive.setHex(0x000000); }
      if ('roughness' in c) c.roughness = 0.78;
      if ('metalness' in c) c.metalness = 0.02;
      // Transparency disabled — opaque meshes render correctly with layer/select dimming
      c.transparent = false;
      c.opacity = 1;
      c.needsUpdate = true;
      return c;
    };
    o.material = Array.isArray(o.material)
      ? o.material.map(cloneOne)
      : cloneOne(o.material);

    o.userData.region = region;
  });
  console.info('[edu-platform] brain coloring done:',
    'totalMeshTraversed=', totalMesh,
    'counts=', JSON.stringify(counts));
  if (unmatchedSamples.length) {
    console.info('[edu-platform] unmatched mesh samples:', JSON.stringify(unmatchedSamples));
  }
}
