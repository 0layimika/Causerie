import { LOOP_STATES } from './config.js';
import { getSilenceTimeout } from './antiDeadEnd.js';
import { BrowserSpeechLayer } from './speechLayer.js';
import { scenarios, pickStarterScenario, getScenario, scenarioMatchesLevel } from './scenarios.js';
import { createTelemetry } from './telemetry.js';
import {
  completeConversation,
  createConversation,
  handleSilence,
  startConversation,
  submitLearnerTurn
} from './orchestrator.js';
import { createLearner, applyComebackLoop, confidenceSnapshot, updateLearnerAfterConversation } from './learnerModel.js';
import { clearState, loadState, saveState } from './storage.js';
import { countWords, escapeHtml, formatDateLabel, nowIso } from './utils.js';

const app = document.querySelector('#app');
const tabs = [...document.querySelectorAll('.tabbar a')];
const deleteButton = document.querySelector('#delete-data-button');

const persisted = loadState();
const state = {
  learner: persisted?.learner || null,
  conversations: persisted?.conversations || [],
  activeConversation: persisted?.activeConversation || null,
  lastDebrief: persisted?.lastDebrief || null,
  selectedVoiceURI: persisted?.selectedVoiceURI || '',
  voices: [],
  telemetry: createTelemetry(persisted?.events || []),
  onboarding: {
    persona: 'immigration',
    level: 'A2',
    confidence: 3,
    consent: false
  },
  listeningTimer: null,
  partialTranscript: ''
};

const speech = new BrowserSpeechLayer({
  onTranscript: ({ text, confidence, final }) => {
    state.partialTranscript = text;
    if (final && text) {
      submitTurn(text, confidence);
    } else {
      renderConversation();
    }
  },
  onError: (reason) => toast(micErrorMessage(reason)),
  onEnd: () => {},
  onVoicesChanged: (voices) => {
    state.voices = voices;
    if (!state.selectedVoiceURI && voices.length) {
      const preferred = voices.find((voice) => voice.lang?.toLowerCase() === 'fr-fr') || voices[0];
      state.selectedVoiceURI = preferred.voiceURI;
      speech.setVoice(state.selectedVoiceURI);
      persist();
    } else {
      speech.setVoice(state.selectedVoiceURI);
    }
    if (state.activeConversation) renderConversation();
  }
});

speech.setVoice(state.selectedVoiceURI);

deleteButton.addEventListener('click', () => {
  if (!confirm('Delete local Causerie data on this device?')) return;
  clearState();
  state.learner = null;
  state.conversations = [];
  state.activeConversation = null;
  state.lastDebrief = null;
  state.telemetry.events.length = 0;
  location.hash = '#home';
  render();
});

window.addEventListener('hashchange', render);
window.addEventListener('beforeunload', persist);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/src/serviceWorker.js').catch(() => {});
}

render();

function render() {
  const route = location.hash.replace('#', '') || 'home';
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.route === route));

  if (!state.learner && route !== 'home') {
    location.hash = '#home';
    return;
  }

  if (route === 'conversation') return renderConversation();
  if (route === 'scenarios') return renderScenarios();
  if (route === 'debrief') return renderDebrief();
  return renderHome();
}

function renderHome() {
  if (!state.learner) {
    app.innerHTML = `
      <section class="hero">
        <div class="hero-card">
          <span class="eyebrow">Conversation-loop first</span>
          <h1>Speak before fear speaks.</h1>
          <p class="lead">Causerie gets you talking French out loud, every day, without judgment. It keeps the conversation alive when you freeze, then gives a kind debrief after.</p>
          <div class="actions">
            <button class="primary-button" type="button" data-action="start-onboarding">Start first rep</button>
            <a class="secondary-button" href="#scenarios">Preview scenarios</a>
          </div>
        </div>
        <form class="card panel" id="onboarding-form">
          <span class="eyebrow">Under 90 seconds to Listening</span>
          <h2>Your first scene</h2>
          ${choiceGroup('Why are you learning?', 'persona', [
            ['immigration', 'Immigration', 'Visa, settlement, exam confidence'],
            ['professional', 'Work', 'Clients, meetings, trade calls'],
            ['other', 'Other', 'General speaking confidence']
          ])}
          ${choiceGroup('Self-placement', 'level', [
            ['A1', 'I can read simple phrases', 'We will keep it tiny and calm'],
            ['A2', 'I can hold a basic chat', 'Recommended starting point'],
            ['B1', 'I can discuss familiar topics', 'More natural follow-ups'],
            ['B2', 'I can explain opinions', 'Faster pace']
          ])}
          <label class="form-row">
            <span>How nervous are you about speaking French?</span>
            <span class="range-row">
              <input name="confidence" type="range" min="1" max="5" value="${state.onboarding.confidence}">
              <strong id="confidence-value">${state.onboarding.confidence}/5</strong>
            </span>
          </label>
          <label class="choice">
            <input name="consent" type="checkbox">
            <strong>I consent to local voice/text processing for this MVP.</strong>
            <small>Raw audio is not stored by this app. You can delete local data anytime.</small>
          </label>
          <button class="primary-button" type="submit">Begin speaking</button>
        </form>
      </section>
    `;
    bindOnboarding();
    return;
  }

  const comeback = applyComebackLoop(state.learner);
  const snapshot = confidenceSnapshot({
    learner: state.learner,
    conversations: state.conversations,
    telemetry: state.telemetry
  });
  persist();

  app.innerHTML = `
    <section class="hero">
      <div class="hero-card">
        <span class="eyebrow">${comeback ? 'Welcome back, easy win first' : 'Today’s speaking rep'}</span>
        <h1>Bonjour, prêt ?</h1>
        <p class="lead">${comeback ? 'No guilt, no lost-progress drama. We will start one level softer for this session and ramp back up.' : 'One short conversation is enough to keep the speaking muscle alive.'}</p>
        <div class="actions">
          <button class="primary-button" type="button" data-action="quick-start">Start a rep</button>
          <a class="secondary-button" href="#scenarios">Choose scenario</a>
        </div>
      </div>
      <div class="card panel">
        <span class="eyebrow">Confidence curve</span>
        <div class="progress-ring" style="--score: ${snapshot.index}%"><span>${snapshot.index}</span></div>
        <div class="stats-grid">
          <div class="stat"><strong>${snapshot.avg_words_per_turn}</strong><span>avg words/turn</span></div>
          <div class="stat"><strong>${Math.round((1 - snapshot.hesitation_rate) * 100)}%</strong><span>smooth turns</span></div>
          <div class="stat"><strong>${state.learner.streak.count}</strong><span>day streak</span></div>
        </div>
        <p class="muted">Last active: ${formatDateLabel(state.learner.streak.last_active)}</p>
      </div>
    </section>
  `;

  app.querySelector('[data-action="quick-start"]').addEventListener('click', () => beginConversation(pickStarterScenario(state.learner).id));
}

function bindOnboarding() {
  app.querySelector('[data-action="start-onboarding"]').addEventListener('click', () => {
    app.querySelector('#onboarding-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  app.querySelectorAll('.choice[data-name]').forEach((button) => {
    button.addEventListener('click', () => {
      state.onboarding[button.dataset.name] = button.dataset.value;
      app.querySelectorAll(`.choice[data-name="${button.dataset.name}"]`).forEach((choice) => {
        choice.setAttribute('aria-pressed', String(choice === button));
      });
    });
  });

  const confidence = app.querySelector('[name="confidence"]');
  confidence.addEventListener('input', () => {
    state.onboarding.confidence = Number(confidence.value);
    app.querySelector('#confidence-value').textContent = `${confidence.value}/5`;
  });

  app.querySelector('#onboarding-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const consent = app.querySelector('[name="consent"]').checked;
    if (!consent) {
      toast('Consent is required before starting voice/text practice.');
      return;
    }
    state.learner = createLearner({
      persona: state.onboarding.persona,
      level: state.onboarding.level,
      effective_level: state.onboarding.level,
      confidence_baseline: state.onboarding.confidence
    });
    state.telemetry.emit('signup', { learner_id: state.learner.id, persona: state.learner.persona, source: 'local_mvp' });
    state.telemetry.emit('confidence_checkin', { learner_id: state.learner.id, value: state.learner.confidence_baseline, cadence: 't0' });
    state.telemetry.emit('onboarding_completed', { learner_id: state.learner.id, time_to_listen_ms: 0 });
    beginConversation(pickStarterScenario(state.learner).id);
  });
}

function renderScenarios() {
  const learner = state.learner || createLearner();
  const cards = scenarios
    .filter((scenario) => scenario.track === learner.persona || learner.persona === 'other')
    .map((scenario) => scenarioCard(scenario, scenarioMatchesLevel(scenario, learner.effective_level)))
    .join('');

  app.innerHTML = `
    <section class="card panel">
      <span class="eyebrow">Scenario library</span>
      <h2>Practice the conversations that matter.</h2>
      <p class="lead">Every scene has a concrete goal, CEFR range, and vocabulary focus. The MVP keeps this curated rather than pretending every topic is equally useful.</p>
      <div class="scenario-grid">${cards}</div>
    </section>
  `;

  app.querySelectorAll('[data-scenario]').forEach((button) => {
    button.addEventListener('click', () => beginConversation(button.dataset.scenario));
  });
}

function renderConversation() {
  if (!state.activeConversation) {
    app.innerHTML = `
      <section class="card panel">
        <h2>No active conversation yet.</h2>
        <p class="lead">Choose a scenario or start today’s quick rep.</p>
        <div class="actions">
          <a class="primary-button" href="#home">Start from home</a>
          <a class="secondary-button" href="#scenarios">Choose scenario</a>
        </div>
      </section>
    `;
    return;
  }

  const conversation = state.activeConversation;
  const scenario = getScenario(conversation.scenario_id);
  const listening = conversation.state === LOOP_STATES.LISTENING;
  const messages = conversation.turns.map((turn) => `
    <div class="bubble ${turn.deadend_rung !== undefined ? 'hint' : turn.speaker}">
      <strong>${turn.speaker === 'ai' ? 'Causerie' : 'You'}</strong><br>
      ${escapeHtml(turn.transcript)}
    </div>
  `).join('');

  app.innerHTML = `
    <section class="conversation-card">
      <div>
        <div class="scene-header">
          <div>
            <span class="badge">${escapeHtml(scenario.track)} · ${escapeHtml(state.learner.effective_level)}</span>
            <h2>${escapeHtml(scenario.title)}</h2>
            <p class="muted">${escapeHtml(scenario.goal)}</p>
          </div>
          <button class="ghost-button" type="button" data-action="end-conversation">End</button>
        </div>
        <div class="transcript" id="transcript">${messages}${state.partialTranscript ? `<div class="bubble learner">${escapeHtml(state.partialTranscript)}</div>` : ''}</div>
      </div>
      <div class="composer">
        <div class="status-strip">
          <span><span class="state-dot ${listening ? 'listening' : ''}"></span> ${escapeHtml(conversation.state)}</span>
          <small>${Math.round(getSilenceTimeout(state.learner.effective_level) / 1000)}s freeze guard</small>
        </div>
        <label class="voice-picker">
          <span>Causerie voice</span>
          <select id="voice-select" ${state.voices.length ? '' : 'disabled'}>
            ${voiceOptions()}
          </select>
        </label>
        <div class="input-row">
          <textarea id="turn-input" placeholder="Type your French if voice is unavailable. Example: Je voudrais ouvrir un compte."></textarea>
          <button class="mic-button" type="button" aria-label="Speak French" aria-pressed="false" data-action="mic">Mic</button>
        </div>
        <div class="button-row">
          <button class="primary-button" type="button" data-action="send-turn">Send turn</button>
          <button class="secondary-button" type="button" data-action="simulate-silence">I’m stuck</button>
          <button class="secondary-button" type="button" data-action="replay">Replay AI</button>
        </div>
      </div>
    </section>
  `;

  app.querySelector('#transcript')?.scrollTo({ top: 99999 });
  app.querySelector('[data-action="send-turn"]').addEventListener('click', () => {
    const input = app.querySelector('#turn-input');
    submitTurn(input.value, 0.95);
    input.value = '';
  });
  app.querySelector('[data-action="simulate-silence"]').addEventListener('click', simulateSilence);
  app.querySelector('[data-action="end-conversation"]').addEventListener('click', endConversation);
  app.querySelector('[data-action="replay"]').addEventListener('click', replayLastAI);
  app.querySelector('[data-action="mic"]').addEventListener('click', toggleMic);
  app.querySelector('#voice-select')?.addEventListener('change', (event) => {
    state.selectedVoiceURI = event.target.value;
    speech.setVoice(state.selectedVoiceURI);
    persist();
    replayLastAI();
  });
}

function beginConversation(scenarioId) {
  if (!state.learner) return;
  applyComebackLoop(state.learner);
  state.activeConversation = createConversation({ learner: state.learner, scenarioId });
  startConversation(state.activeConversation, state.telemetry);
  state.partialTranscript = '';
  persist();
  location.hash = '#conversation';
  setTimeout(() => {
    const firstAi = state.activeConversation?.turns.find((turn) => turn.speaker === 'ai')?.transcript;
    speakAI(firstAi);
  }, 100);
}

function submitTurn(text, confidence = 0.9) {
  if (!state.activeConversation) return;
  const transcript = text.trim();
  state.partialTranscript = '';
  const result = submitLearnerTurn({
    conversation: state.activeConversation,
    learner: state.learner,
    transcript,
    confidence,
    durationMs: Math.max(1000, countWords(transcript) * 420),
    telemetry: state.telemetry
  });
  persist();
  renderConversation();
  if (result?.aiText) speakAI(result.aiText);
  if (result?.escalation) speakAI(result.escalation.copy);
  if (result?.debrief) {
    finalizeConversation(result.debrief);
    location.hash = '#debrief';
  }
}

function simulateSilence() {
  if (!state.activeConversation) return;
  const result = handleSilence({
    conversation: state.activeConversation,
    learner: state.learner,
    telemetry: state.telemetry
  });
  persist();
  renderConversation();
  speakAI(result.escalation.copy);
}

function endConversation() {
  state.lastDebrief = completeConversationIfNeeded('user_ended');
  location.hash = '#debrief';
}

function completeConversationIfNeeded(reason = 'goal_reached') {
  if (!state.activeConversation) return state.lastDebrief;
  const debrief = state.activeConversation.state === LOOP_STATES.DEBRIEF
    ? state.lastDebrief
    : completeConversation({ conversation: state.activeConversation, learner: state.learner, telemetry: state.telemetry, reason });

  return finalizeConversation(debrief);
}

function finalizeConversation(debrief) {
  if (!state.activeConversation) return debrief;
  updateLearnerAfterConversation(state.learner, state.activeConversation, nowIso());
  state.conversations.unshift(state.activeConversation);
  state.activeConversation = null;
  state.lastDebrief = debrief;
  persist();
  return debrief;
}

function renderDebrief() {
  const debrief = state.lastDebrief;
  if (!debrief) {
    app.innerHTML = `
      <section class="card panel">
        <h2>No debrief yet.</h2>
        <p class="lead">Finish a conversation and your strength-first coaching note will appear here.</p>
        <a class="primary-button" href="#home">Start a rep</a>
      </section>
    `;
    return;
  }

  const issues = debrief.top_issues.length
    ? debrief.top_issues.map((issue) => `
      <article class="issue-card">
        <span class="badge">${escapeHtml(issue.type)}</span>
        <h3>${escapeHtml(issue.detail)}</h3>
        <p><strong>You said:</strong> ${escapeHtml(issue.said || 'A hesitation')}</p>
        ${issue.model ? `<p><strong>Try:</strong> ${escapeHtml(issue.model)}</p>` : ''}
      </article>
    `).join('')
    : '<article class="issue-card"><h3>No major fixes today.</h3><p>Keep stacking reps. That counts.</p></article>';

  app.innerHTML = `
    <section class="debrief-card panel">
      <span class="eyebrow">Strength first, correction after</span>
      <h2>Today’s debrief</h2>
      <article class="mini-card">
        <h3>What went well</h3>
        <p>${escapeHtml(debrief.opened_with_strength)}</p>
      </article>
      <div class="debrief-grid">${issues}</div>
      <article class="mini-card">
        <h3>One quick win</h3>
        <p>${escapeHtml(debrief.quick_win)}</p>
      </article>
      <div class="actions">
        <button class="primary-button" type="button" data-action="next-rep">Do another rep</button>
        <a class="secondary-button" href="#home">View progress</a>
      </div>
    </section>
  `;

  state.telemetry.emit('debrief_viewed', {
    conversation_id: debrief.conversation_id,
    n_issues: debrief.top_issues.length,
    drills_offered: debrief.optional_drills.length
  });
  persist();
  app.querySelector('[data-action="next-rep"]').addEventListener('click', () => beginConversation(pickStarterScenario(state.learner).id));
}

async function toggleMic(event) {
  speech.bargeIn();
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Allow';
  const started = await speech.start();
  button.disabled = false;
  button.textContent = 'Mic';
  if (!started) {
    button.setAttribute('aria-pressed', 'false');
    return;
  }
  button.setAttribute('aria-pressed', 'true');
}

function replayLastAI() {
  const text = [...(state.activeConversation?.turns || [])].reverse().find((turn) => turn.speaker === 'ai')?.transcript;
  speakAI(text);
}

function speakAI(text) {
  if (!text) return;
  speech.setVoice(state.selectedVoiceURI);
  speech.speak(text);
}

function voiceOptions() {
  if (!state.voices.length) {
    return '<option>No browser voices found yet</option>';
  }

  return state.voices.map((voice) => `
    <option value="${escapeHtml(voice.voiceURI)}" ${voice.voiceURI === state.selectedVoiceURI ? 'selected' : ''}>
      ${escapeHtml(voice.name)} (${escapeHtml(voice.lang || 'unknown')})
    </option>
  `).join('');
}

function scenarioCard(scenario, recommended) {
  return `
    <article class="scenario-card">
      <span class="badge">${escapeHtml(scenario.track)} · ${escapeHtml(scenario.level_range.join('-'))}</span>
      <h3>${escapeHtml(scenario.title)}</h3>
      <p>${escapeHtml(scenario.goal)}</p>
      <p class="muted">Focus: ${escapeHtml([...scenario.grammar_focus, ...scenario.vocab_focus].slice(0, 4).join(', '))}</p>
      <button class="${recommended ? 'primary-button' : 'secondary-button'}" type="button" data-scenario="${escapeHtml(scenario.id)}">
        ${recommended ? 'Recommended' : 'Practice this'}
      </button>
    </article>
  `;
}

function choiceGroup(label, name, options) {
  return `
    <div class="form-row">
      <span>${label}</span>
      <div class="choice-grid">
        ${options.map(([value, title, description], index) => `
          <button class="choice" type="button" data-name="${name}" data-value="${value}" aria-pressed="${index === 1 || (name === 'persona' && index === 0)}">
            <strong>${title}</strong>
            <small>${description}</small>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function toast(message) {
  const template = document.querySelector('#toast-template');
  const node = template.content.firstElementChild.cloneNode(true);
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 3200);
}

function persist() {
  saveState({
    learner: state.learner,
    conversations: state.conversations,
    activeConversation: state.activeConversation,
    lastDebrief: state.lastDebrief,
    selectedVoiceURI: state.selectedVoiceURI,
    events: state.telemetry.events
  });
}

function micErrorMessage(reason) {
  const messages = {
    insecure_context: 'Microphone access needs HTTPS or localhost. On Vercel HTTPS is fine; locally use localhost/127.0.0.1.',
    get_user_media_unavailable: 'This browser cannot request microphone access. Try Chrome or Edge.',
    NotAllowedError: 'Microphone permission was blocked. Allow mic access in your browser settings and try again.',
    NotFoundError: 'No microphone device was found on this computer.',
    NotReadableError: 'Your microphone is busy in another app. Close that app and try again.',
    speech_recognition_unavailable: 'Mic access worked, but this browser does not support speech recognition. Try Chrome, or use text fallback.',
    speech_start_failed: 'The browser could not start voice recognition. Try again or use text fallback.'
  };

  return messages[reason] || 'Voice input could not start. Try allowing microphone access, or use text fallback.';
}
