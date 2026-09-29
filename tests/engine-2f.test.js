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
    rows:[
      'F ? . . .',
      '3 F ? F 2',
      '? F 3 3 F',
      'F 4 2 ? F',
      'F F ? 1 ?'
    ],
    mine:['C1'],
    safe:['D1','E1']
  }
];

for(const tc of cases){
  const out = infer2F({mode:'2F', size:5, mines:10, board:parse(tc.rows)});
  assert.equal(out.ok, true, tc.name + ': solver returned error');
  assert.deepStrictEqual(out.mine, tc.mine, tc.name + ': mine mismatch');
  assert.deepStrictEqual(out.safe, tc.safe, tc.name + ': safe mismatch');
}

console.log(`${ENGINE_2F_VERSION}: ${cases.length}/${cases.length} regression cases passed`);
