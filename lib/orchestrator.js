import { LOOP_STATES } from './config.js';
import { detectDeadEnd, getEscalation, nextRung } from './antiDeadEnd.js';
import { generateDebrief } from './debrief.js';
import { getScenario } from './scenarios.js';
import { countWords, lowerLevel, nowIso, uid } from './utils.js';

export function createConversation({ learner, scenarioId }) {
  const scenario = getScenario(scenarioId);
  return {
    id: uid('convo'),
    learner_id: learner.id,
    scenario_id: scenario.id,
    started_at: nowIso(),
    status: 'active',
    state: LOOP_STATES.SCENE_SET,
    turns: [],
    capture: [],
    promptIndex: 0,
    currentRung: 0,
    consecutiveStalls: 0,
    successfulTurnsAfterSimplify: 0,
    scenario
  };
}

export function startConversation(conversation, telemetry) {
  transition(conversation, LOOP_STATES.AI_SPEAKING, telemetry);
  addAITurn(conversation, conversation.scenario.opener);
  transition(conversation, LOOP_STATES.LISTENING, telemetry);
  telemetry.emit('conversation_started', {
    conversation_id: conversation.id,
    scenario_id: conversation.scenario_id,
    level: conversation.scenario.level_range.join('-')
  });
  return conversation;
}

export function submitLearnerTurn({ conversation, learner, transcript, confidence = 0.9, durationMs = 1800, telemetry }) {
  transition(conversation, LOOP_STATES.CAPTURING, telemetry);
  const deadEnd = detectDeadEnd({
    transcript,
    confidence,
    durationMs,
    consecutiveStalls: conversation.consecutiveStalls
  });

  if (deadEnd.triggered) {
    return handleDeadEnd({ conversation, learner, signal: deadEnd.signal, telemetry });
  }

  transition(conversation, LOOP_STATES.PROCESSING, telemetry);
  conversation.currentRung = 0;
  conversation.consecutiveStalls = 0;
  conversation.successfulTurnsAfterSimplify += 1;
  if (conversation.successfulTurnsAfterSimplify >= 2) {
    learner.effective_level = learner.level;
  }

  const learnerTurn = {
    id: uid('turn'),
    index: conversation.turns.length,
    speaker: 'learner',
    transcript,
    asr_confidence: confidence,
    duration_ms: durationMs
  };
  conversation.turns.push(learnerTurn);
  collectCaptureEvents({ conversation, learnerTurn });

  telemetry.emit('turn_completed', {
    conversation_id: conversation.id,
    turn_index: learnerTurn.index,
    words: countWords(transcript),
    duration_ms: durationMs,
    asr_conf: confidence
  });

  const response = generateAIResponse(conversation, learner, transcript);
  addAITurn(conversation, response.text, response.recast);
  transition(conversation, LOOP_STATES.AI_SPEAKING, telemetry);
  transition(conversation, LOOP_STATES.LISTENING, telemetry);

  if (learnerTurns(conversation).length >= 6) {
    const debrief = completeConversation({ conversation, learner, telemetry, reason: 'goal_reached' });
    return { type: 'completed', conversation, aiText: response.text, debrief };
  }

  return { type: 'turn', conversation, aiText: response.text };
}

export function handleSilence({ conversation, learner, telemetry }) {
  return handleDeadEnd({ conversation, learner, signal: 'silence', telemetry });
}

export function completeConversation({ conversation, learner, telemetry, reason = 'user_ended' }) {
  conversation.status = learnerTurns(conversation).length >= 4 ? 'completed' : 'abandoned';
  conversation.ended_at = nowIso();
  conversation.end_reason = reason;
  transition(conversation, LOOP_STATES.DEBRIEF, telemetry);
  const debrief = generateDebrief(conversation, learner);
  telemetry.emit(conversation.status === 'completed' ? 'conversation_completed' : 'conversation_abandoned', {
    conversation_id: conversation.id,
    n_turns: learnerTurns(conversation).length,
    duration: Date.parse(conversation.ended_at) - Date.parse(conversation.started_at),
    end_reason: reason,
    last_state: conversation.state,
    last_rung: conversation.currentRung
  });
  telemetry.emit('debrief_ready', { conversation_id: conversation.id });
  return debrief;
}

function handleDeadEnd({ conversation, learner, signal, telemetry }) {
  transition(conversation, LOOP_STATES.DEADEND_CHECK, telemetry);
  const escalation = getEscalation(conversation.currentRung);
  conversation.consecutiveStalls += 1;

  if (escalation.rung === 4) {
    learner.effective_level = lowerLevel(learner.level);
    conversation.successfulTurnsAfterSimplify = 0;
  }

  conversation.capture.push({
    conversation_id: conversation.id,
    turn_id: uid('turn'),
    type: 'hesitation',
    detail: signal,
    said: '',
    impact: 'med',
    fixability: 'high',
    struggle_tag: 'speaking_freeze'
  });

  addAITurn(conversation, escalation.copy, false, escalation.rung);
  telemetry.emit('deadend_escalation', {
    conversation_id: conversation.id,
    rung: escalation.rung,
    trigger_signal: signal
  });
  conversation.currentRung = nextRung(conversation.currentRung);
  transition(conversation, LOOP_STATES.AI_SPEAKING, telemetry);
  transition(conversation, LOOP_STATES.LISTENING, telemetry);

  return { type: 'deadend', conversation, escalation };
}

function generateAIResponse(conversation, learner, transcript) {
  const scenario = conversation.scenario;
  const prompt = scenario.prompts[conversation.promptIndex % scenario.prompts.length];
  conversation.promptIndex += 1;

  const issue = detectSimpleIssue(transcript);
  if (issue) {
    return {
      text: `${issue.recast} ${prompt}`,
      recast: true
    };
  }

  const levelPhrase = learner.effective_level === 'A1' ? 'Très bien. ' : 'Merci, c’est clair. ';
  return {
    text: `${levelPhrase}${prompt}`,
    recast: false
  };
}

function collectCaptureEvents({ conversation, learnerTurn }) {
  if (learnerTurn.transcript.length > 18) {
    conversation.capture.push({
      conversation_id: conversation.id,
      turn_id: learnerTurn.id,
      type: 'strength',
      detail: 'Tu as donné une réponse complète au lieu d’un seul mot.',
      said: learnerTurn.transcript,
      impact: 'med',
      fixability: 'high'
    });
  }

  const issue = detectSimpleIssue(learnerTurn.transcript);
  if (issue) {
    conversation.capture.push({
      conversation_id: conversation.id,
      turn_id: learnerTurn.id,
      type: 'grammar',
      detail: issue.detail,
      said: issue.said,
      model: issue.model,
      impact: 'high',
      fixability: 'high',
      struggle_tag: issue.tag
    });
  }

  if (countWords(learnerTurn.transcript) < 4) {
    conversation.capture.push({
      conversation_id: conversation.id,
      turn_id: learnerTurn.id,
      type: 'vocab_gap',
      detail: 'réponse plus complète',
      said: learnerTurn.transcript,
      model: `${learnerTurn.transcript}, parce que c’est important pour moi.`,
      impact: 'med',
      fixability: 'high',
      struggle_tag: 'short_answers'
    });
  }
}

function detectSimpleIssue(text) {
  const lower = text.toLowerCase();
  if (lower.includes('à le')) {
    return {
      detail: 'contraction à + le',
      said: 'à le',
      model: 'au',
      tag: 'contraction_au',
      recast: 'Ah, tu veux dire au marché.'
    };
  }
  if (lower.includes('je suis allé') && lower.includes('elle')) {
    return {
      detail: 'accord avec être',
      said: 'elle est venu',
      model: 'elle est venue',
      tag: 'passe_compose_accord',
      recast: 'Oui, elle est venue, et c’est important.'
    };
  }
  return null;
}

function addAITurn(conversation, transcript, recastApplied = false, deadendRung = undefined) {
  conversation.turns.push({
    id: uid('turn'),
    index: conversation.turns.length,
    speaker: 'ai',
    transcript,
    recast_applied: recastApplied,
    deadend_rung: deadendRung
  });
}

function transition(conversation, state, telemetry) {
  conversation.state = state;
  telemetry.emit('state', { conversation_id: conversation.id, value: state });
}

function learnerTurns(conversation) {
  return conversation.turns.filter((turn) => turn.speaker === 'learner');
}
