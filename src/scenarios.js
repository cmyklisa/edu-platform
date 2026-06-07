// 情境模式索引：從 scenarios.json 讀入。
// 每個情境 = 一連串「波次 wave」，每波可同時播多條 pathways。

import data from '../scenarios.json';

export const scenariosList = data;
export const scenarioRegistry = new Map(data.map(s => [s.id, s]));
