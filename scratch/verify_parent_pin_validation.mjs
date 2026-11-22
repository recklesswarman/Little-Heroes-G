// Regression test: Parent PIN validation and the lock screen no longer leaking the default PIN.
import fs from 'node:fs';
import { makeFS, makeDevice, makeRunner } from './parent_panel_device_harness.mjs';

const { check, expect, finish } = makeRunner('🔢 --- Verifying Parent PIN validation --- 🔢');
const D = makeDevice(makeFS(1), { sync: false });
const store = D.store;

await check('rejects empty, short, long and non-digit PINs without changing the saved PIN', async () => {
  store.setParentPin('7777');
  for (const bad of ['', '   ', '123', '12a4', '123456789', '12 34', null, undefined]) {
    const r = store.setParentPin(bad);
    expect(r.success === false && /4 to 8 digits/.test(r.error), `"${bad}" was accepted: ${JSON.stringify(r)}`);
    expect(store.getState().parentSettings.pin === '7777', `"${bad}" changed the PIN to ${store.getState().parentSettings.pin}`);
  }
});

await check('accepts 4 to 8 digits and trims spaces', async () => {
  for (const good of ['0000', '12345678']) {
    const r = store.setParentPin(good);
    expect(r.success && store.getState().parentSettings.pin === good, `${good} -> ${JSON.stringify(r)}`);
  }
  const r = store.setParentPin(' 4821 ');
  expect(r.success && store.getState().parentSettings.pin === '4821', `trim -> ${store.getState().parentSettings.pin}`);
  expect(store.getState().parentSettings.pinLockEnabled === true, 'saving a PIN should turn the PIN lock on');
});

await check('verifyParentPin matches only the saved PIN', async () => {
  expect(store.verifyParentPin('4821') && store.verifyParentPin(' 4821 '), 'saved PIN not accepted');
  expect(!store.verifyParentPin('1234') && !store.verifyParentPin(''), 'wrong PIN accepted');
});

await check('saving a PIN stamps it for sync', async () => {
  expect(Number(store.getState().parentSettings.fieldStamps?.pin) > 0, 'pin has no change stamp');
});

await check('lock screen no longer shows the default PIN', async () => {
  const src = fs.readFileSync(new URL('../src/components/ParentLockModal.js', import.meta.url), 'utf8');
  expect(!/1234/.test(src), 'ParentLockModal.js still mentions 1234');
  expect(/verifyParentPin\(/.test(src), 'ParentLockModal.js should check the PIN with store.verifyParentPin');
});

finish('parent PIN');
