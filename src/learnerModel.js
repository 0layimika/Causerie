import { DEFAULT_LEARNER } from './config.js';
import { daysBetween, nowIso, clamp } from './utils.js';

export function createLearner(partial = {}) {
  const createdAt = nowIso();
  return {
    ...DEFAULT_LEARNER,
    created_at: createdAt,
    streak: { ...DEFAULT_LEARNER.streak },
    ...partial
  };
}

export function applyComebackLoop(learner, today = nowIso()) {
  const inactiveDays = daysBetween(learner.streak.last_active, today);
  if (inactiveDays >= 4) {
    const order = ['A1', 'A2', 'B1', 'B2'];
    learner.effective_level = order[Math.max(0, order.indexOf(learner.level) - 1)];
    return true;
  }
  learner.effective_level = learner.level;
  return false;
}

export function updateLearnerAfterConversation(learner, conversation, at = nowIso()) {
  const previousActive = learner.streak.last_active;
  const gap = daysBetween(previousActive, at);

  if (!previousActive || gap === 1) {
    learner.streak.count += 1;
  } else if (gap > 1 && learner.streak.saves_remaining > 0) {
    learner.streak.saves_remaining -= 1;
    learner.streak.count += 1;
  } else if (gap > 1) {
    learner.streak.count = 1;
  }

  learner.streak.last_active = at;

  for (const event of conversation.capture || []) {
    if (!event.struggle_tag || event.type === 'strength') continue;
    const existing = learner.struggle_areas.find((area) => area.tag === event.struggle_tag);
    if (existing) {
      existing.error_count += 1;
      existing.last_seen = at;
    } else {
      learner.struggle_areas.push({ tag: event.struggle_tag, error_count: 1, last_seen: at });
    }
  }
}

export function confidenceSnapshot({ learner, conversations, telemetry, at = nowIso() }) {
  const completedTurns = telemetry.events.filter((event) => event.type === 'turn_completed');
  const deadends = telemetry.events.filter((event) => event.type === 'deadend_escalation');
  const started = telemetry.events.filter((event) => event.type === 'conversation_started').length;
  const abandoned = telemetry.events.filter((event) => event.type === 'conversation_abandoned').length;

  const avgWords = completedTurns.length
    ? completedTurns.reduce((sum, event) => sum + (event.words || 0), 0) / completedTurns.length
    : 0;
  const abandonRate = started ? abandoned / started : 0;
  const hesitationRate = completedTurns.length ? deadends.length / completedTurns.length : 0;
  const speakingDays = new Set(
    conversations
      .filter((conversation) => conversation.status === 'completed')
      .map((conversation) => conversation.ended_at?.slice(0, 10))
      .filter(Boolean)
  ).size;

  const index = clamp(
    Math.round(
      30 +
      Math.min(avgWords * 4, 28) +
      24 * (1 - abandonRate) +
      14 * (1 - Math.min(hesitationRate, 1)) +
      Math.min(speakingDays * 3, 12)
    ),
    0,
    100
  );

  return {
    learner_id: learner.id,
    at,
    self_report: learner.confidence_baseline,
    index,
    avg_words_per_turn: Number(avgWords.toFixed(1)),
    abandon_rate: Number(abandonRate.toFixed(2)),
    hesitation_rate: Number(hesitationRate.toFixed(2)),
    speaking_days_7d: speakingDays
  };
}
