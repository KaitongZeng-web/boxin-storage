import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('README embeds the three-screen mobile preview',()=>{
  const path='docs/images/app-preview.png';
  assert.ok(readFileSync('README.md','utf8').includes(']('+path+')'));
  const png=readFileSync(path);
  assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[2372,1688]);
});
