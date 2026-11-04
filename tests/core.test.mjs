import test from 'node:test';
import assert from 'node:assert/strict';
import {splitChapters,buildChunks,normalizeName,mergeEntries,parseAIResult,exportClean,exportGrouped} from '../src/core.mjs';
test('tách và giữ đủ nội dung',()=>{
  const t='第1章 开始\n程然和秋下月。\n第2章 继续\n林清雾来了。';
  assert.equal(splitChapters(t).length,2);
  assert.equal(buildChunks(t,550).length,1);
  assert.equal(splitChapters(t).map(x=>x.heading).join(','),'第1章 开始,第2章 继续');
});
test('chương dài được chia và không mất chữ',()=>{
  const txt='第1章 测试\n'+'程然努力修行。'.repeat(1000);
  const chunks=buildChunks(txt,550);
  assert.ok(chunks.length>1);
  assert.equal(chunks.map(c=>c.text).join('').replace(/\s/g,''),txt.replace(/\s/g,''));
});
test('lọc khóa giả và khóa không xuất hiện',()=>{
  assert.equal(normalizeName({zh:'程然',vi:'Trình Nhiên',category:'PERSON'},'程然').vi,'Trình Nhiên');
  assert.equal(normalizeName({zh:'林清雾',vi:'Lâm Thanh Vụ'},'程然'),null);
  assert.equal(normalizeName({zh:'',vi:'x'},'x'),null);
});
test('trùng giữ bản đầu và lưu biến thể',()=>{
  const e=mergeEntries([{zh:'程然',vi:'Trình Nhiên',category:'PERSON',count:1}], [{zh:'程然',vi:'Trình Nhiên khác',category:'PERSON'}],'程然');
  assert.equal(e.length,1);assert.equal(e[0].count,2);assert.deepEqual(e[0].alternatives,['Trình Nhiên khác']);
});
test('xuất QT sạch và nhóm',()=>{
  const e=[{zh:'林清雾',vi:'Lâm Thanh Vụ',category:'PERSON'},{zh:'程然',vi:'Trình Nhiên',category:'PERSON'},{zh:'心斋境',vi:'cảnh Tâm Trai',category:'REALM'}];
  assert.ok(exportClean(e).startsWith('林清雾='));
  assert.ok(!exportGrouped(e).includes('# Cảnh giới'));
  assert.ok(exportGrouped(e,{includeTerms:true}).includes('# Cảnh giới'));
  assert.ok(!exportClean(e).includes('#'));
});
test('parse JSON có wrapper Markdown',()=>assert.equal(parseAIResult('```json\n{"names":[{"zh":"程然","vi":"Trình Nhiên"}]}\n```').length,1));

test('NAME proper excludes grade-terms by default',()=>{
  const e=[{zh:'林清雾',vi:'Lâm Thanh Vụ',category:'PERSON'},{zh:'心斋境',vi:'cảnh Tâm Trai',category:'REALM'}];
  assert.ok(!exportGrouped(e).includes('# Cảnh giới'));
  assert.ok(exportGrouped(e,{includeTerms:true}).includes('# Cảnh giới'));
});
