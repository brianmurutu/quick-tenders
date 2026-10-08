import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultNextRunPhrase } from '../lib/discovery-notifications.ts';

test('defaultNextRunPhrase returns formatted schedule text', () => {
  const phrase = defaultNextRunPhrase();
  assert.ok(phrase.includes('at 07:23 EAT'));
  assert.ok(phrase.includes('04:23 UTC'));
});
