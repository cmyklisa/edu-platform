// 解剖結構索引：從 structures.json 讀入，建構 id → struct 的 Map。
// 之後（階段④）通路會 reference 這些 id。

import data from '../structures.json';

export const structuresList = data;
export const structureRegistry = new Map(data.map(s => [s.id, s]));

export const SYSTEM_LABEL = {
  cortex:     '大腦皮質',
  limbic:     '邊緣系統',
  brainstem:  '腦幹',
  cerebellum: '小腦',
  spinal:     '脊髓',
  stimulus:   '外部刺激',
  organ:      '末梢器官',
};

export const SYSTEM_COLORS = {
  cortex:     0x6aa6ff,
  limbic:     0xb38cff,
  brainstem:  0xff9a55,
  cerebellum: 0x80d68b,
  spinal:     0x54d1d6,
  stimulus:   0xff5a5a,
  organ:      0xff8aa8,
};
