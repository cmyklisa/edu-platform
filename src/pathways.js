// 功能通路索引：從 pathways.json 讀入。

import data from '../pathways.json';

export const pathwaysList = data;
export const pathwayRegistry = new Map(data.map(p => [p.id, p]));
