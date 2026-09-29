'use strict';

const assert = require('assert');
const { infer2F, ENGINE_2F_VERSION } = require('../engine-2f.js');

function parse(rows){
  return rows.map(row => row.trim().split(/\s+/).map(token => {
    if(token === '.') return {t:'e'};
    if(token === '?') return {t:'q'};
    if(token === 'F') return {t:'f'};
    return {t:'n', v:Number(token)};
  }));
}

const cases = [
  {
    name:'5x5 initial',
    size:5,
    mines:10,
    rows:[
      '. ? . . .',
      '3 . ? . .',
      '? . . . .',
      '. . . . .',
      '. . . 1 .'
    ],
    mine:['A1','B2','B3'],
    safe:['B4','C3','C4']
  },
  {
    name:'5x5 after first deductions',
    size:5,
    mines:10,
    rows:[
      'F ? . . .',
      '3 F ? . .',
      '? F 3 . .',
      '. 4 2 . .',
      '. . . 1 .'
    ],
    mine:['A4','A5','D2'],
    safe:['D3','D4']
  },
  {
    name:'5x5 middle',
    size:5,
    mines:10,
    rows:[
      'F ? . . .',
      '3 F ? . .',
      '? F 3 3 .',
      'F 4 2 ? .',
      'F . . 1 .'
    ],
    mine:['B5','D2','E3','E4'],
    safe:['C5','E2','E5']
  },
  {
    name:'5x5 finish',
    size:5,
    mines:10,
    rows:[
      'F ? . . .',
      '3 F ? F 2',
      '? F 3 3 F',
      'F 4 2 ? F',
      'F F ? 1 ?'
    ],
    mine:['C1'],
    safe:['D1','E1']
  },
  {
    name:'7x7 first nested contradiction',
    size:7,
    mines:20,
    rows:[
      '. . . 3 3 F F',
      '. . . F F 5 .',
      '. . . ? 4 F .',
      '. 5 . . 3 . .',
      'F F ? 2 F 4 3',
      '3 4 2 2 ? F F',
      'F ? F 1 2 F 3'
    ],
    mine:['C1','C3'],
    safe:['C2']
  }
];

for(const tc of cases){
  const out = infer2F({mode:'2F', size:tc.size, mines:tc.mines, board:parse(tc.rows)});
  assert.equal(out.ok, true, tc.name + ': solver returned error');
  assert.deepStrictEqual(out.mine, tc.mine, tc.name + ': mine mismatch');
  assert.deepStrictEqual(out.safe, tc.safe, tc.name + ': safe mismatch');
}

console.log(`${ENGINE_2F_VERSION}: ${cases.length}/${cases.length} regression cases passed`);
