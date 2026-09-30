import assert from 'node:assert/strict';
import test from 'node:test';
import { validateImageBytes } from '../supabase/functions/_shared/image-validation.ts';

function png(width, height) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width, false);
  new DataView(bytes.buffer).setUint32(20, height, false);
  return bytes;
}

function jpeg(width, height) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

test('reads PNG dimensions from actual bytes', () => {
  assert.deepEqual(validateImageBytes(png(1200, 900)), { mimeType: 'image/png', width: 1200, height: 900 });
});

test('reads JPEG dimensions from actual bytes', () => {
  assert.deepEqual(validateImageBytes(jpeg(640, 480)), { mimeType: 'image/jpeg', width: 640, height: 480 });
});

test('rejects a renamed or malformed non-image payload', () => {
  assert.equal(validateImageBytes(new TextEncoder().encode('<script>alert(1)</script>')), null);
});
