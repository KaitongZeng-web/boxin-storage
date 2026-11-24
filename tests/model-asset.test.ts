import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('ships the U2NetP model used by the sticker workshop',()=>{
  const model=readFileSync(new URL('../models/u2netp.onnx',import.meta.url));
  assert.equal(createHash('sha256').update(model).digest('hex'),'309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8');
});
