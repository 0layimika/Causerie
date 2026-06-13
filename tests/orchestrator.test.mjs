import test from 'node:test';
import assert from 'node:assert/strict';
import { LOOP_STATES } from '../lib/config.js';
import { createLearner } from '../lib/learnerModel.js';
import { createTelemetry } from '../lib/telemetry.js';
import {
  completeConversation,
  createConversation,
  handleSilence,
  startConversation,
  submitLearnerTurn
} from '../lib/orchestrator.js';

test('conversation starts with AI opener and reaches Listening', () => {
  const learner = createLearner();
  const telemetry = createTelemetry();
  const conversation = createConversation({ learner, scenarioId: 'immigration-visa-a2' });
  startConversation(conversation, telemetry);

  assert.equal(conversation.turns[0].speaker, 'ai');
  assert.equal(conversation.state, LOOP_STATES.LISTENING);
  assert.equal(telemetry.count('conversation_started'), 1);
});

test('dead-end never terminates the conversation', () => {
  const learner = createLearner({ level: 'A2', effective_level: 'A2' });
  const telemetry = createTelemetry();
  const conversation = startConversation(createConversation({ learner, scenarioId: 'immigration-visa-a2' }), telemetry);

  for (let i = 0; i < 100; i += 1) {
    handleSilence({ conversation, learner, telemetry });
    assert.notEqual(conversation.state, LOOP_STATES.DEBRIEF);
    assert.equal(conversation.status, 'active');
  }

  assert.equal(telemetry.count('deadend_escalation'), 100);
});

test('successful learner turn resets dead-end rung and logs turn_completed', () => {
  const learner = createLearner();
  const telemetry = createTelemetry();
  const conversation = startConversation(createConversation({ learner, scenarioId: 'immigration-visa-a2' }), telemetry);

  handleSilence({ conversation, learner, telemetry });
  assert.equal(conversation.currentRung, 1);
  submitLearnerTurn({
    conversation,
    learner,
    transcript: 'Je voudrais travailler en français parce que c’est utile.',
    telemetry
  });

  assert.equal(conversation.currentRung, 0);
  assert.equal(telemetry.count('turn_completed'), 1);
});

test('debrief is strength-first and limits issues to three', () => {
  const learner = createLearner();
  const telemetry = createTelemetry();
  const conversation = startConversation(createConversation({ learner, scenarioId: 'immigration-visa-a2' }), telemetry);

  for (let i = 0; i < 4; i += 1) {
    submitLearnerTurn({
      conversation,
      learner,
      transcript: 'Je suis allé à le marché avec ma famille.',
      telemetry
    });
  }

  const debrief = completeConversation({ conversation, learner, telemetry, reason: 'user_ended' });
  assert.ok(debrief.opened_with_strength.length > 0);
  assert.ok(debrief.top_issues.length <= 3);
  assert.equal(typeof debrief.quick_win, 'string');
});
