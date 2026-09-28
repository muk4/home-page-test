import type { Blueprint } from './blueprint';

/**
 * Production lines, drawn as data (legend in blueprint.ts). Every line runs
 * ore -> furnace -> plate -> assembler -> gear -> chest (the short "mini"
 * lines stop at plates). The last inserter has two chests: in front of it
 * and beside it, so it can keep packing while an AGV swaps the full one.
 * The layout packs the lines into the free space around the text and flips
 * them for variety.
 */
export const BLUEPRINTS: Blueprint[] = [
  {
    name: 'mini',
    rows: [
      'MM>>v.......C.',
      'MM..>>eFFe>>eC',
      '.......FF.....',
    ],
  },
  {
    name: 'kompakt',
    rows: [
      'MM>>v.......AAA....',
      'MM..v.FF....AAA..C.',
      '....>eFFe>>eAAAe>eC',
    ],
  },
  {
    name: 'linia',
    rows: [
      'MM>>>>v...........AAA........',
      'MM....v....FF.....AAA......C.',
      '......>>>>eFFe>>>eAAAe>>>>>eC',
    ],
  },
  {
    name: 'mini-paliwo',
    rows: [
      'MM>>v.......C.',
      'MM..>>eFFe>>eC',
      '.......FF.....',
      '.......=......',
      '....TT==......',
      '....TT........',
    ],
  },
  {
    name: 'linia-paliwo',
    rows: [
      'MM>>>>v...........AAA........',
      'MM....v....FF.....AAA......C.',
      '......>>>>eFFe>>>eAAAe>>>>>eC',
      '...........=.......=.........',
      '...........====TT===.........',
      '...............TT............',
    ],
  },
  {
    name: 'huta-mala',
    rows: [
      '....>>>>>>>>>v..........',
      '....n..n.....v...AAA....',
      '...FF.FF.....v...AAA..C.',
      '...FF.FF.....>>>eAAAe>eC',
      'MM.n..n.................',
      'MM>>>>>>................',
    ],
  },
  {
    name: 'huta',
    rows: [
      '....>>>>>>>>>>>>v............',
      '....n..n..n.....v....AAA.....',
      '...FF.FF.FF.....v....AAA...C.',
      '...FF.FF.FF.....>>>>eAAAe>>eC',
      '...n..n..n............=......',
      'MM>>>>>>>>>...TT=======......',
      'MM............TT.............',
    ],
  },
];
