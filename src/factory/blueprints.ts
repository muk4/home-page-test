import type { Blueprint } from './blueprint';

/**
 * Production lines, drawn as data (legend in blueprint.ts). Every line runs
 * ore -> furnace -> plate -> assembler -> gear -> chest (the short "mini"
 * lines stop at plates). The last inserter has two chests: in front of it
 * and beside it, so it can keep packing while an AGV swaps the full one.
 * The layout packs the lines into the free space around the text and flips
 * them for variety.
 *
 * Ore is picked in belt order, so the first furnace takes whatever arrives:
 * one drill (0.8 ore/s) feeds a single furnace (1 ore/s) and leaves any
 * further furnace on the same belt idle. The multi-furnace lines therefore
 * get extra drills stacked beside the head of the ore belt; they keep the
 * lines' original footprint, so the packing (and the look) stays the same.
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
    // Narrow lines that fold back on themselves: they fit a phone screen whole.
    name: 'zawijas',
    phoneOnly: true,
    rows: [
      'MM>>v........',
      'MM..>eFFe>>>v',
      '......FF....v',
      '....C.......v',
      '...Cw<wAAAw<<',
      '.......AAA...',
      '.......AAA...',
    ],
  },
  {
    name: 'zawijas-mini',
    phoneOnly: true,
    rows: [
      'MM>>v........',
      'MM..>eFFe>>>v',
      '......FF....v',
      '....C.......v',
      '...Cw<<<<<<<<',
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
      'MM.FF.FF.....v...AAA..C.',
      'MMvFF.FF.....>>>eAAAe>eC',
      'MMvn..n.................',
      'MM>>>>>>................',
    ],
  },
  {
    name: 'huta',
    rows: [
      '....>>>>>>>>>>>>v............',
      'MM..n..n..n.....v....AAA.....',
      'MMvFF.FF.FF.....v....AAA...C.',
      'MMvFF.FF.FF.....>>>>eAAAe>>eC',
      'MMvn..n..n............=......',
      'MM>>>>>>>>>...TT=======......',
      'MM............TT.............',
    ],
  },
];
