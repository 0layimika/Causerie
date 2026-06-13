import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDeadEnd, getEscalation, getSilenceTimeout, nextRung } from '../lib/antiDeadEnd.js';

test('uses level-scaled silence thresholds', () => {
  assert.equal(getSilenceTimeout('A1'), 7000);
  assert.equal(getSilenceTimeout('B2'), 4000);
});

test('detects all MVP dead-end signals', () => {
  assert.equal(detectDeadEnd({ silence: true }).signal, 'silence');
  assert.equal(detectDeadEnd({ transcript: '', confidence: 0.9 }).signal, 'empty_low_confidence_asr');
  assert.equal(detectDeadEnd({ transcript: 'bonjour', confidence: 0.2 }).signal, 'empty_low_confidence_asr');
  assert.equal(detectDeadEnd({ transcript: 'je ne sais pas' }).signal, 'explicit_stuck_phrase');
  assert.equal(detectDeadEnd({ transcript: 'I need to open a bank account please' }).signal, 'language_fallback');
  assert.equal(detectDeadEnd({ transcript: 'euh', durationMs: 1200 }).signal, 'explicit_stuck_phrase');
});

test('advances escalation without exceeding the ladder', () => {
  assert.equal(getEscalation(0).rung, 0);
  assert.equal(nextRung(0), 1);
  assert.equal(nextRung(5), 5);
  assert.equal(getEscalation(99).rung, 5);
});
