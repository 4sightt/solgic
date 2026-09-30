'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

class Element {
  constructor(){
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.style = {};
    this.classList = {add(){}};
    this.textContent = '';
    this.value = '';
  }
  set innerHTML(_value){ this.children = []; }
  appendChild(child){ this.children.push(child); }
  addEventListener(name, fn){ this.listeners[name] = fn; }
  dispatchEvent(event){ return this.listeners[event.type]?.(event); }
  click(){ return this.listeners.click?.(); }
  focus(){}
  getBoundingClientRect(){ return {left:0, right:600, top:0, height:600, width:600}; }
  closest(){ return this; }
}

async function run(){
  const ids = ['board','axisTop','axisLeft','modeSel','sizeSel','minesInp','minesPresetSel','copyBtn','pasteBtn','clearBtn','inferBtn','stateBox','selInfo','lastInfo','fileInfo','stateDumpBtn','modePill','stateCard'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  elements.sizeSel.value = '5';
  const document = {
    title:'Solgic3-0.0.0',
    getElementById:id => elements[id],
    createElement:() => new Element(),
    querySelector:() => new Element(),
    addEventListener(name,fn){ this[name] = fn; }
  };
  const clipboard = {text:'', async writeText(value){ this.text = value; }, async readText(){ return this.text; }};
  const {ENGINE_Q_VERSION, inferQ} = require('../engine-q.js');
  const {ENGINE_2G_VERSION, infer2G} = require('../engine-2g.js');
  const {ENGINE_2C_VERSION, infer2C} = require('../engine-2c.js');
  const {ENGINE_2F_VERSION} = require('../engine-2f.js');
  const script = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    document, navigator:{clipboard}, window:{addEventListener(){}},
    requestAnimationFrame(){}, Event:class {constructor(type){this.type=type;}},
    ENGINE_Q_VERSION, ENGINE_2G_VERSION, ENGINE_2C_VERSION, ENGINE_2F_VERSION,
    inferQ, infer2G, infer2C,
    infer2F(){ return {ok:true, mine:['A1'], safe:['B1'], exhausted:true, checkLines:['proof check'], proofs:{secret:'raw-proof-should-not-appear'}}; }
  });
  const el = id => elements[id];
  const mode = value => { el('modeSel').value = value; el('modeSel').dispatchEvent({type:'change'}); };
  const cell = (x,y,button=0) => el('board').dispatchEvent({type:'mousedown', target:el('board').children[y*5+x], button, preventDefault(){}});
  const state = () => el('stateBox').textContent;

  for(const [value,version] of [['q',ENGINE_Q_VERSION],['2g',ENGINE_2G_VERSION],['2c',ENGINE_2C_VERSION],['2f',ENGINE_2F_VERSION]]){
    mode(value);
    assert.ok(el('fileInfo').textContent.includes(`Active Engine: ${version}`));
    assert.ok(state().includes(`ENGINE: ${version}`));
  }
  el('minesInp').value = '10';
  el('minesInp').dispatchEvent({type:'change'});
  el('inferBtn').click();
  assert.ok(state().includes('STATUS: OK'));
  assert.ok(state().includes('MINE: A1'));
  assert.ok(!state().includes('raw-proof-should-not-appear'));
  cell(0,0);
  cell(1,0);
  document.keydown({key:'2',preventDefault(){}});
  assert.ok(state().includes('1. A1 = ?'));
  assert.ok(state().includes('2. B1 = 2'));
  assert.ok(el('lastInfo').textContent.includes('Inference: OK'));
  await el('copyBtn').click();
  assert.ok(state().includes('MINE: A1'));
  await el('stateDumpBtn').click();
  assert.equal(clipboard.text, state());
  assert.ok(!clipboard.text.includes('Selected:'));
  assert.ok(!clipboard.text.includes('raw-proof-should-not-appear'));
  cell(0,0);
  document.keydown({key:'Backspace',preventDefault(){}});
  assert.ok(!state().includes('A1 ='));
  assert.ok(state().includes('1. B1 = 2'));

  el('inferBtn').click();
  assert.ok(state().includes('CHANGES SINCE LAST INFERENCE:\n(none)'));
  el('minesInp').value = '12';
  el('minesInp').dispatchEvent({type:'change'});
  assert.ok(state().includes('TOTAL MINES: 10 -> 12'));
  assert.ok(state().includes('TOTAL MINES AT INFERENCE: 10'));
  assert.ok(state().includes('STATUS: OK'));
  mode('q');
  assert.ok(state().includes('STATUS: NONE'));
  mode('w');
  assert.ok(state().includes('ENGINE: none'));
  assert.ok(state().includes('[....] = four W slots in order'));
  clipboard.text = JSON.stringify({mode:'2F',size:5,mines:10,board:Array.from({length:5},(_,y) => Array.from({length:5},(_,x) => x === 0 && y === 0 ? {t:'q'} : x === 1 && y === 0 ? {t:'f'} : {t:'e'}))});
  await el('pasteBtn').click();
  assert.ok(state().includes('MODE: 2F'));
  assert.ok(state().includes('1 | ? F . . .'));
  assert.ok(state().includes('STATUS: NONE'));
  console.log('UI state integration: engine display, copy/paste, change reset, inference retention, W dump passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
