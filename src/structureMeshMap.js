// 每個 structure 對到一組 Z-Anatomy mesh 名稱關鍵字。
// 點選 structure（透過 marker 或直接點 mesh）時，所有 selectableIds 含該 id 的 mesh
// 都會被視為「該結構的一部份」→ 保持高亮、其他 mesh 淡化。
//
// 插入順序：specific 在前、broad lobe 在後。
//   - 第一個 match 寫成 primary structureId（被點到時用這個 id 觸發 selection）
//   - 之後 match 只加進 selectableIds Set
// 這樣 orbital_part 的 primary 是 prefrontal-cortex（點到該 mesh 會選前額葉），
// 但點 frontal-lobe marker 時 orbital_part 也會跟著亮（Set 含 frontal-lobe）。

export const STRUCTURE_MESH_PATTERNS = {
  // ── 12 對腦神經（先比對，避免被 brainstem 廣詞攔截）
  'cn-1-olfactory':         ['olfactory_nerve', 'olfactory_bulb', 'olfactory_tract'],
  'cn-2-optic':             ['optic_nerve'],
  'cn-3-oculomotor':        ['oculomotor_nerve'],
  'cn-4-trochlear':         ['trochlear_nerve'],
  'cn-5-trigeminal':        ['trigeminal_nerve', 'ophthalmic_nerve', 'maxillary_nerve',
                             'mandibular_nerve', 'inferior_alveolar', 'lingual_nerve',
                             'buccal_nerve', 'mental_nerve', 'mylohyoid', 'auriculotemporal',
                             'meningeal_branch_of_maxillary'],
  'cn-6-abducens':          ['abducens_nerve'],
  'cn-7-facial':            ['facial_nerve'],
  'cn-8-vestibulocochlear': ['vestibulocochlear', 'vestibular_nerve', 'cochlear_nerve'],
  'cn-9-glossopharyngeal':  ['glossopharyngeal'],
  'cn-10-vagus':            ['vagus_nerve'],
  'cn-11-accessory':        ['accessory_nerve'],
  'cn-12-hypoglossal':      ['hypoglossal'],

  // ── 具體深部結構（最優先匹配，primary 就是自己）
  'amygdala':           ['amygdal'],
  'hippocampus':        ['hippocampus', 'parahippocampal'],
  'hypothalamus':       ['hypothalamus', 'mammillary', 'mamillary'],
  'thalamus':           ['thalamusl', 'thalamusr', 'stria_medullaris_thalami', 'geniculate_body'],
  'pag':                ['aqueduct_of_midbrain'],
  'midbrain':           ['midbrain', 'mesencephal', 'tegmentum', 'tectum',
                         'cerebral_peduncle', 'base_of_peduncle', 'colliculus',
                         'substantia_nigra', 'red_nucleus', 'oculomotor', 'trochlear'],
  'pons':               ['ponsl', 'ponsr', 'ponti', 'trigeminal', 'abducens'],
  'medulla':            ['medulla_oblongat', 'pyramid_of_medulla', 'olive',
                         'cochlear_nucleus', 'vestibular', 'vagus', 'hypoglossal',
                         'salivatory', 'ambiguus', 'solitary_tract', 'facial_nerve',
                         'glossopharyngeal'],
  'cerebellum':         ['cerebellum', 'cerebellar', 'vermis', 'tonsil_of_cerebellum',
                         'flocc', 'culmen', 'declive', 'folium', 'nodulus',
                         'arbor_vitae', 'uvula', 'quadrangular_lobule',
                         'biventral_lobule', 'gracile_lobule', 'semilunar_lobule',
                         'wing_of_central_lobule'],

  // ── 皮質子結構（前額葉 — 額葉的一部份）
  'prefrontal-cortex':  ['orbital_part', 'orbital_gyri', 'orbital_sulci',
                         'frontomarginal', 'frontopolar', 'gyrus_rectus'],

  // ── 大腦皮質葉（broad；會疊加到上面已 tag 的 mesh）
  // frontal-lobe 故意把 prefrontal 的關鍵字也納入，這樣點額葉時前額葉也跟著亮
  'frontal-lobe':       ['frontal', 'precentral', 'cingulate', 'paracentral',
                         'gyrus_rectus', 'olfactory_sulcus', 'orbital_part',
                         'orbital_gyri', 'orbital_sulci', 'frontomarginal',
                         'frontopolar', 'operculum'],
  'parietal-lobe':      ['parietal', 'postcentral', 'angular_gyrus', 'precuneus',
                         'supramarginal'],
  // temporal-lobe 把 amygdala/hippocampus 也納入（解剖上這兩個在內側顳葉）
  'temporal-lobe':      ['temporal', 'fusiform', 'heschl', 'planum', 'insula',
                         'amygdal', 'hippocampus', 'parahippocampal'],
  'occipital-lobe':     ['occipital', 'calcarine', 'lingual_gyrus', 'cuneus'],
};

export function tagBrainMeshes(root) {
  const stats = {};
  const ensureSet = (obj) => {
    if (!obj.userData.structureIds) obj.userData.structureIds = new Set();
    return obj.userData.structureIds;
  };
  for (const [structureId, keywords] of Object.entries(STRUCTURE_MESH_PATTERNS)) {
    const lowered = keywords.map(k => k.toLowerCase());
    let n = 0;
    root.traverse(o => {
      if (!o.isMesh || !o.name) return;
      if (o.userData.isMarker || o.userData.isOverlay) return;
      const lower = o.name.toLowerCase();
      if (!lowered.some(k => lower.includes(k))) return;
      const set = ensureSet(o);
      set.add(structureId);
      // primary structureId = first inserted（最 specific）
      if (!o.userData.structureId) o.userData.structureId = structureId;
      n++;
    });
    stats[structureId] = n;
  }
  console.info('[edu-platform] brain meshes tagged per structure:', JSON.stringify(stats));
}
