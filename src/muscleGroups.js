// 把 muscle layer 的每個 mesh 依名稱關鍵字對到一個「肌肉群」
// （胸大肌、肱二頭肌、股四頭肌…）。每個肌肉群有自己的代表色與 structureId，
// → 不同肌肉一眼可分辨，點選後跳出對應的中文名與功能說明。
//
// 排序：越具體的 keyword 越前面（例如 'flexor_carpi' 要在通用 'flexor' 之前；
// 不過實作上我們不用 'flexor' 廣詞，每群都列出明確的解剖名稱以避免誤配對）。
// 連結組織（fascia、bursa、tendon_sheath、retinaculum、aponeurosis、ligament）
// 不列進任何群，保留預設色且不可點選，避免把肌膜當肌肉教給使用者。

export const MUSCLE_GROUPS = [
  // ── 頭/臉/頸 ─────────────────────────────────────────────────
  {
    id: 'facial-muscles',
    color: 0xffaeb8,
    keywords: [
      'frontalis_muscle', 'occipitalis_muscle', 'temporoparietalis_muscle',
      'zygomaticus_major', 'zygomaticus_minor',
      'orbicularis_oris', 'orbicularis_oculi',
      'mentalis_muscle', 'nasalis_muscle', 'procerus_muscle', 'risorius_muscle',
      'depressor_anguli_oris', 'depressor_labii_inferioris', 'depressor_septi_nasi',
      'levator_anguli_oris', 'levator_labii_superioris', 'levator_nasolabialis',
      'levator_palpebrae_superioris',
      'bucinator', 'corrugator_supercilii', 'platysma',
      'epicranial_aponeurosis',
    ],
  },
  {
    id: 'masseter-group',
    color: 0xc06363,
    keywords: [
      'masseter', 'temporalis_muscle',
      'lateral_pterygoid', 'medial_pterygoid',
    ],
  },
  {
    id: 'sternocleidomastoid',
    color: 0xe07058,
    keywords: ['sternocleidomastoid'],
  },
  {
    id: 'neck-deep-muscles',
    color: 0x9a4a58,
    keywords: [
      'scalenus_anterior', 'scalenus_medius', 'scalenus_posterior',
      'longus_capitis', 'longus_colli',
      'rectus_anterior_capitis', 'rectus_lateralis_capitis',
      'omohyoid', 'sternohyoid', 'sternothyroid', 'thyrohyoid',
      'digastric_muscle', 'geniohyoid', 'mylohyoid', 'stylohyoid',
      'splenius_capitis', 'splenius_colli',
    ],
  },

  // ── 軀幹前 ──────────────────────────────────────────────────
  {
    id: 'pectoralis-major',
    color: 0xd14242,
    keywords: ['pectoralis_major'],
  },
  {
    id: 'abdominal-muscles',
    color: 0xe85c50,
    keywords: [
      'rectus_abdominis',
      'external_abdominal_oblique', 'internal_abdominal_oblique',
      'transversus_abdominis', 'pyramidalis_muscle',
      'quadratus_lumborum', 'linea_alba',
    ],
  },

  // ── 肩 ──────────────────────────────────────────────────────
  {
    id: 'deltoid',
    color: 0xff8a3d,
    keywords: ['deltoid_muscle', 'part_of_deltoid_muscle'],
  },
  {
    id: 'rotator-cuff',
    color: 0xa078ff,
    keywords: [
      'supraspinatus_muscle', 'infraspinatus_muscle',
      'teres_minor_muscle', 'subscapularis_muscle',
    ],
  },

  // ── 上臂 ─────────────────────────────────────────────────────
  {
    id: 'biceps-brachii',
    color: 0xf7c948,
    keywords: ['biceps_brachii', 'brachialis_muscle', 'coracobrachialis'],
  },
  {
    id: 'triceps-brachii',
    color: 0xc89a3a,
    keywords: ['triceps_brachii'],
  },

  // ── 前臂 ─────────────────────────────────────────────────────
  {
    id: 'forearm-flexors',
    color: 0xeb6a8a,
    keywords: [
      'flexor_carpi_radialis', 'flexor_carpi_ulnaris',
      'flexor_digitorum_superficialis', 'flexor_digitorum_profundus',
      'flexor_pollicis_longus',
      'palmaris_longus_muscle',
      'pronator_teres', 'pronator_quadratus',
    ],
  },
  {
    id: 'forearm-extensors',
    color: 0xc14e8a,
    keywords: [
      'extensor_carpi_radialis', 'extensor_carpi_ulnaris',
      'extensor_digitorum', 'extensor_digiti_minimi',
      'extensor_indicis',
      'extensor_pollicis_brevis', 'extensor_pollicis_longus',
      'abductor_pollicis_longus',
      'brachioradialis_muscle', 'anconeus_muscle', 'supinator',
    ],
  },

  // ── 背 ──────────────────────────────────────────────────────
  {
    id: 'trapezius',
    color: 0x9a5dff,
    keywords: ['trapezius_muscle', 'part_of_trapezius'],
  },
  {
    id: 'latissimus-dorsi',
    color: 0x7a4dde,
    keywords: ['latissimus_dorsi', 'teres_major'],
  },
  {
    id: 'erector-spinae',
    color: 0x5e3a8f,
    keywords: [
      'iliocostalis', 'longissimus', 'spinalis_thoracis',
      'spinalis_colli', 'spinalis_capitis',
      'multifidus', 'rotatores', 'semispinalis',
      'interspinales',
      'rhomboid_major', 'rhomboid_minor', 'levator_scapulae',
      'serratus_posterior',
      'obliquus_inferior_capitis', 'obliquus_superior_capitis',
      'rectus_posterior_major_capitis', 'rectus_posterior_minor_capitis',
    ],
  },

  // ── 髖/臀 ───────────────────────────────────────────────────
  {
    id: 'gluteus-maximus',
    color: 0xc25e34,
    keywords: ['gluteus_maximus'],
  },
  {
    id: 'hip-stabilizers',
    color: 0xd58148,
    keywords: [
      'gluteus_medius', 'gluteus_minimus', 'tensor_fasciae_latae',
      'piriformis_muscle',
      'superior_gemellus', 'inferior_gemellus',
      'obturator_internus', 'obturator_externus',
      'quadratus_femoris',
      'iliacus_muscle', 'psoas_major',
    ],
  },

  // ── 大腿 ────────────────────────────────────────────────────
  {
    id: 'quadriceps',
    color: 0x42b88e,
    keywords: [
      'rectus_femoris', 'vastus_lateralis', 'vastus_medialis',
      'vastus_intermedius', 'sartorius_muscle',
    ],
  },
  {
    id: 'hamstrings',
    color: 0x2e7d5b,
    keywords: [
      'biceps_femoris', 'semimembranosus', 'semitendinosus',
    ],
  },
  {
    id: 'adductors',
    color: 0x6ab04c,
    keywords: [
      'adductor_longus', 'adductor_magnus', 'adductor_brevis',
      'adductor_minimus',
      'gracilis_muscle', 'pectineus_muscle',
    ],
  },

  // ── 小腿 ────────────────────────────────────────────────────
  {
    id: 'calf-muscles',
    color: 0x3da8c2,
    keywords: [
      'gastrocnemius', 'soleus_muscle', 'plantaris_muscle',
      'popliteus_muscle',
      'tibialis_posterior',
      'flexor_digitorum_longus', 'flexor_hallucis_longus',
    ],
  },
  {
    id: 'tibialis-anterior-group',
    color: 0x4cd0e0,
    keywords: [
      'tibialis_anterior',
      'extensor_digitorum_longus', 'extensor_hallucis_longus',
      'fibularis_longus', 'fibularis_brevis', 'fibularis_tertius',
    ],
  },
];

// 連結組織關鍵字：碰到這些就跳過著色 + 跳過 tag（保留半透明預設色，
// 不會被當肌肉教給使用者）。
const CONNECTIVE_TISSUE_KEYWORDS = [
  'fascia', 'bursa', 'tendon_sheath', 'retinaculum',
  'aponeurosis', 'ligament', 'tarsus', 'septum',
  'tendinous_arch', 'tract', 'tendon_of_', 'common_tendon',
  'iliopectineal_arch',
];

function findMuscleGroup(meshName) {
  const lower = meshName.toLowerCase();
  // 連結組織直接 skip（不算肌肉群）
  for (const kw of CONNECTIVE_TISSUE_KEYWORDS) {
    if (lower.includes(kw)) return null;
  }
  for (const g of MUSCLE_GROUPS) {
    for (const kw of g.keywords) {
      if (lower.includes(kw.toLowerCase())) return g;
    }
  }
  return null;
}

// 在 muscle layer 載入後（loadAlignedLayer 已經 per-mesh clone material）呼叫：
// 1. 每個 mesh 依名稱對到一個肌肉群 → 設 userData.structureId/structureIds
// 2. 直接 mutate material.color（material 已 per-mesh，不會誤改到別 mesh）
// 3. 沒命中肌肉群的 mesh（連結組織、不認識的小肌肉）保留載入時的預設 muscle 紅色，
//    且不設 structureId（→ selection raycaster 不會選到它們）
// 回傳 { matched: number, unmatched: number, perGroup: { id: count } }
export function tagAndColorMuscles(root) {
  const perGroup = {};
  let matched = 0, unmatched = 0;
  const sampleUnmatched = [];

  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    if (o.userData.isMarker || o.userData.isOverlay) return;

    const group = findMuscleGroup(o.name || '');

    if (group) {
      o.userData.structureId = group.id;
      o.userData.structureIds = new Set([group.id]);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        m.color.setHex(group.color);
        // 教學用：讓肌肉群色彩比真實感優先：
        //   1. toneMapped=false 保留純色相不被 ACES tone curve 壓掉
        //   2. emissive 設為自體色 × intensity：背光肌肉也能保留明顯色相
        //      （MeshStandard 的 emissive 不參與 lighting → 自體發光）
        m.toneMapped = false;
        if (m.emissive) {
          m.emissive.setHex(group.color);
          // intensity 0.7：emissive 主導色相、背光區也看得到顏色；
          // 仍留約 30% 給 diffuse lit term 提供肌肉束立體感
          m.emissiveIntensity = 0.7;
          // 把原始 emissive 紀錄成 group color，避免被 layerManager 的
          // isNerveAnimated 或 selection 流程「還原成 0」（會把肌肉變黑）
          m.userData._origEmissive = m.emissive.getHex();
        }
        m.needsUpdate = true;
      }
      matched++;
      perGroup[group.id] = (perGroup[group.id] || 0) + 1;
    } else {
      unmatched++;
      if (sampleUnmatched.length < 8) sampleUnmatched.push(o.name);
    }
  });

  return { matched, unmatched, perGroup, sampleUnmatched };
}
