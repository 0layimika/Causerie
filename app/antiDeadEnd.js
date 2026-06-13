import {
  ASR_CONFIDENCE_FLOOR,
  DEADEND_LADDER,
  FILLER_WORDS,
  FRENCH_MARKERS,
  SILENCE_TIMEOUT_MS,
  STUCK_PHRASES
} from './config.js';
import { countWords, normalizeText, tokenize } from './utils.js';

export function getSilenceTimeout(level) {
  return SILENCE_TIMEOUT_MS[level] || SILENCE_TIMEOUT_MS.A2;
}

export function detectDeadEnd({ transcript = '', confidence = 1, durationMs = 1500, silence = false, consecutiveStalls = 0 } = {}) {
  const normalized = normalizeText(transcript);
  const tokens = tokenize(transcript);

  if (silence) return { triggered: true, signal: 'silence' };
  if (!normalized || confidence < ASR_CONFIDENCE_FLOOR) return { triggered: true, signal: 'empty_low_confidence_asr' };
  if (STUCK_PHRASES.some((phrase) => normalized.includes(normalizeText(phrase)))) return { triggered: true, signal: 'explicit_stuck_phrase' };
  if (isLanguageFallback(tokens)) return { triggered: true, signal: 'language_fallback' };
  if (isFillerOnly(tokens) || countWords(transcript) < 2 || durationMs < 1000) return { triggered: true, signal: 'filler_subthreshold' };
  if (consecutiveStalls >= 2) return { triggered: true, signal: 'repeated_stall' };

  return { triggered: false, signal: null };
}

export function getEscalation(rung) {
  return DEADEND_LADDER[Math.min(Math.max(rung, 0), DEADEND_LADDER.length - 1)];
}

export function nextRung(currentRung) {
  return Math.min(currentRung + 1, DEADEND_LADDER.length - 1);
}

function isFillerOnly(tokens) {
  return tokens.length > 0 && tokens.every((token) => FILLER_WORDS.has(token));
}

function isLanguageFallback(tokens) {
  if (tokens.length < 4) return false;
  const frenchish = tokens.filter((token) => FRENCH_MARKERS.has(token)).length;
  return frenchish / tokens.length < 0.4;
}
