import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {updaterAvailable,backupProjects}=require('../src/updater.cjs');

test('chỉ bản Windows đã cài đặt mới tự cập nhật',()=>{
  assert.equal(updaterAvailable({platform:'win32',isPackaged:true,portableExecutable:undefined}),true);
  assert.equal(updaterAvailable({platform:'win32',isPackaged:true,portableExecutable:'C:\\portable.exe'}),false);
  assert.equal(updaterAvailable({platform:'win32',isPackaged:false}),false);
  assert.equal(updaterAvailable({platform:'linux',isPackaged:true}),false);
});
test('sao lưu file tiến độ trước khi cài cập nhật',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'name-updater-'));
  try{
    await mkdir(join(dir,'projects'));
    await writeFile(join(dir,'projects','p_12345678.json'),'{}');
    await writeFile(join(dir,'projects','irrelevant.txt'),'skip');
    const result=await backupProjects(dir);
    assert.equal(result.count,1);
    assert.equal(await readFile(join(result.location,'p_12345678.json'),'utf8'),'{}');
    assert.equal((await readdir(result.location)).length,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
