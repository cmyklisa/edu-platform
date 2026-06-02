// 解剖結構索引：從 structures.json 讀入，建構 id → struct 的 Map。
// 之後（階段④）通路會 reference 這些 id。

import data from '../structures.json';

export const structuresList = data;
export const structureRegistry = new Map(data.map(s => [s.id, s]));

export const SYSTEM_LABEL = {
  frontal:    '額葉',
  parietal:   '頂葉',
  temporal:   '顳葉',
  occipital:  '枕葉',
  limbic:     '邊緣系統',
  brainstem:  '腦幹',
  cerebellum: '小腦',
  spinal:     '脊髓',
  stimulus:   '外部刺激',
  organ:      '末梢器官',
};

// 每區一個顏色，方便學習者一眼分辨；同時用在 markers 與 brain mesh 著色
export const SYSTEM_COLORS = {
  frontal:    0x6aa6ff,  // 藍
  parietal:   0xa68bff,  // 紫藍
  temporal:   0xff9a8b,  // 珊瑚
  occipital:  0xffd76a,  // 金黃
  limbic:     0xd178ff,  // 紫紅（深部）
  brainstem:  0xff9a55,  // 橘
  cerebellum: 0x80d68b,  // 綠
  spinal:     0x54d1d6,  // 青
  stimulus:   0xff5a5a,  // 警示紅
  organ:      0xff8aa8,  // 粉
};
