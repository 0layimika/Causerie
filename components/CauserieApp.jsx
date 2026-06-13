'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LOOP_STATES } from '../lib/config.js';
import { getSilenceTimeout } from '../lib/antiDeadEnd.js';
import { generateDebrief } from '../lib/debrief.js';
import { confidenceSnapshot, createLearner, applyComebackLoop, updateLearnerAfterConversation } from '../lib/learnerModel.js';
import {
  completeConversation,
  createConversation,
  handleSilence,
  startConversation,
  submitLearnerTurn
} from '../lib/orchestrator.js';
import { getScenario, pickStarterScenario, scenarioMatchesLevel, scenarios } from '../lib/scenarios.js';
import { BrowserSpeechLayer } from '../lib/speechLayer.js';
import { clearState, loadState, saveState } from '../lib/storage.js';
import { createTelemetry } from '../lib/telemetry.js';
import { countWords, formatDateLabel, nowIso } from '../lib/utils.js';

const emptyOnboarding = {
  persona: 'immigration',
  level: 'A2',
  confidence: 3,
  consent: false
};

export default function CauserieApp() {
  const [route, setRoute] = useState('home');
  const [learner, setLearner] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [lastDebrief, setLastDebrief] = useState(null);
  const [onboarding, setOnboarding] = useState(emptyOnboarding);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [toast, setToast] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const telemetryRef = useRef(createTelemetry());
  const speechRef = useRef(null);

  useEffect(() => {
    const persisted = loadState();
    if (persisted) {
      setLearner(persisted.learner || null);
      setConversations(persisted.conversations || []);
      setActiveConversation(persisted.activeConversation || null);
      setLastDebrief(persisted.lastDebrief || null);
      telemetryRef.current = createTelemetry(persisted.events || []);
    }

    const fromHash = window.location.hash.replace('#', '') || 'home';
    setRoute(fromHash);
    setHydrated(true);

    const onHashChange = () => setRoute(window.location.hash.replace('#', '') || 'home');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    speechRef.current = new BrowserSpeechLayer({
      onTranscript: ({ text, confidence, final }) => {
        setPartialTranscript(text);
        if (final && text) submitTurn(text, confidence);
      },
      onError: () => showToast('Voice input is unavailable here, so text fallback is ready.')
    });
  }, [hydrated, activeConversation, learner]);

  useEffect(() => {
    if (!hydrated) return;
    saveState({
      learner,
      conversations,
      activeConversation,
      lastDebrief,
      events: telemetryRef.current.events
    });
  }, [hydrated, learner, conversations, activeConversation, lastDebrief]);

  const snapshot = useMemo(() => {
    if (!learner) return null;
    return confidenceSnapshot({ learner, conversations, telemetry: telemetryRef.current });
  }, [learner, conversations, activeConversation]);

  function navigate(nextRoute) {
    window.location.hash = nextRoute;
    setRoute(nextRoute);
  }

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }

  function resetData() {
    if (!window.confirm('Delete local Causerie data on this device?')) return;
    clearState();
    telemetryRef.current = createTelemetry();
    setLearner(null);
    setConversations([]);
    setActiveConversation(null);
    setLastDebrief(null);
    setOnboarding(emptyOnboarding);
    navigate('home');
  }

  function beginConversation(scenarioId) {
    if (!learner) return;
    const learnerDraft = structuredClone(learner);
    applyComebackLoop(learnerDraft);
    const conversation = createConversation({ learner: learnerDraft, scenarioId });
    startConversation(conversation, telemetryRef.current);
    setLearner(learnerDraft);
    setActiveConversation({ ...conversation });
    setPartialTranscript('');
    navigate('conversation');
    window.setTimeout(() => speakAI(conversation.turns.find((turn) => turn.speaker === 'ai')?.transcript), 100);
  }

  function finishConversation(reason = 'user_ended', knownDebrief = null) {
    if (!activeConversation || !learner) return;
    const conversation = structuredClone(activeConversation);
    const learnerDraft = structuredClone(learner);
    const debrief = knownDebrief || (
      conversation.state === LOOP_STATES.DEBRIEF
        ? generateDebrief(conversation, learnerDraft)
        : completeConversation({ conversation, learner: learnerDraft, telemetry: telemetryRef.current, reason })
    );

    updateLearnerAfterConversation(learnerDraft, conversation, nowIso());
    setLearner(learnerDraft);
    setConversations((items) => [conversation, ...items]);
    setActiveConversation(null);
    setLastDebrief(debrief);
    navigate('debrief');
  }

  function submitTurn(text, confidence = 0.9) {
    if (!activeConversation || !learner) return;
    const transcript = text.trim();
    if (!transcript) return;
    const conversation = structuredClone(activeConversation);
    const learnerDraft = structuredClone(learner);
    const result = submitLearnerTurn({
      conversation,
      learner: learnerDraft,
      transcript,
      confidence,
      durationMs: Math.max(1000, countWords(transcript) * 420),
      telemetry: telemetryRef.current
    });

    setPartialTranscript('');
    setLearner(learnerDraft);
    setActiveConversation({ ...conversation });
    if (result?.aiText) speakAI(result.aiText);
    if (result?.escalation) speakAI(result.escalation.copy);
    if (result?.debrief) {
      setActiveConversation({ ...conversation });
      window.setTimeout(() => finishConversation('goal_reached', result.debrief), 0);
    }
  }

  function simulateSilence() {
    if (!activeConversation || !learner) return;
    const conversation = structuredClone(activeConversation);
    const learnerDraft = structuredClone(learner);
    const result = handleSilence({ conversation, learner: learnerDraft, telemetry: telemetryRef.current });
    setLearner(learnerDraft);
    setActiveConversation({ ...conversation });
    speakAI(result.escalation.copy);
  }

  function speakAI(text) {
    if (!text) return;
    speechRef.current?.speak(text);
  }

  function startOnboarding(event) {
    event.preventDefault();
    if (!onboarding.consent) {
      showToast('Consent is required before starting voice/text practice.');
      return;
    }
    const nextLearner = createLearner({
      persona: onboarding.persona,
      level: onboarding.level,
      effective_level: onboarding.level,
      confidence_baseline: onboarding.confidence
    });
    telemetryRef.current.emit('signup', { learner_id: nextLearner.id, persona: nextLearner.persona, source: 'vercel_next_mvp' });
    telemetryRef.current.emit('confidence_checkin', { learner_id: nextLearner.id, value: nextLearner.confidence_baseline, cadence: 't0' });
    telemetryRef.current.emit('onboarding_completed', { learner_id: nextLearner.id, time_to_listen_ms: 0 });
    setLearner(nextLearner);

    const scenario = pickStarterScenario(nextLearner);
    const conversation = createConversation({ learner: nextLearner, scenarioId: scenario.id });
    startConversation(conversation, telemetryRef.current);
    setActiveConversation({ ...conversation });
    navigate('conversation');
    window.setTimeout(() => speakAI(conversation.turns.find((turn) => turn.speaker === 'ai')?.transcript), 100);
  }

  let page = <HomePage
    learner={learner}
    snapshot={snapshot}
    onboarding={onboarding}
    setOnboarding={setOnboarding}
    startOnboarding={startOnboarding}
    beginConversation={beginConversation}
    navigate={navigate}
  />;

  if (route === 'scenarios') {
    page = <ScenariosPage learner={learner} beginConversation={beginConversation} />;
  }
  if (route === 'conversation') {
    page = <ConversationPage
      learner={learner}
      conversation={activeConversation}
      partialTranscript={partialTranscript}
      submitTurn={submitTurn}
      simulateSilence={simulateSilence}
      finishConversation={finishConversation}
      speakAI={speakAI}
      speechRef={speechRef}
      showToast={showToast}
      navigate={navigate}
    />;
  }
  if (route === 'debrief') {
    page = <DebriefPage debrief={lastDebrief} learner={learner} beginConversation={beginConversation} navigate={navigate} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Causerie home">
          <span className="brand-mark">C</span>
          <span>
            <strong>Causerie</strong>
            <small>Daily French speaking reps</small>
          </span>
        </a>
        <button className="ghost-button" type="button" onClick={resetData}>Delete data</button>
      </header>
      <main id="app" tabIndex="-1">{page}</main>
      <nav className="tabbar" aria-label="Primary navigation">
        {['home', 'scenarios', 'conversation', 'debrief'].map((item) => (
          <a key={item} className={route === item ? 'active' : ''} href={`#${item}`}>
            {item === 'conversation' ? 'Speak' : item[0].toUpperCase() + item.slice(1)}
          </a>
        ))}
      </nav>
      {toast ? <output className="toast" role="status">{toast}</output> : null}
    </div>
  );
}

function HomePage({ learner, snapshot, onboarding, setOnboarding, startOnboarding, beginConversation, navigate }) {
  if (learner) {
    const comeback = applyComebackLoop(structuredClone(learner));
    return (
      <section className="hero">
        <div className="hero-card">
          <span className="eyebrow">{comeback ? 'Welcome back, easy win first' : 'Today’s speaking rep'}</span>
          <h1>Bonjour, prêt ?</h1>
          <p className="lead">{comeback ? 'No guilt. We start one level softer and ramp back up.' : 'One short conversation is enough to keep the speaking muscle alive.'}</p>
          <div className="actions">
            <button className="primary-button" type="button" onClick={() => beginConversation(pickStarterScenario(learner).id)}>Start a rep</button>
            <button className="secondary-button" type="button" onClick={() => navigate('scenarios')}>Choose scenario</button>
          </div>
        </div>
        <div className="card panel">
          <span className="eyebrow">Confidence curve</span>
          <div className="progress-ring" style={{ '--score': `${snapshot?.index || 0}%` }}><span>{snapshot?.index || 0}</span></div>
          <div className="stats-grid">
            <div className="stat"><strong>{snapshot?.avg_words_per_turn || 0}</strong><span>avg words/turn</span></div>
            <div className="stat"><strong>{Math.round((1 - (snapshot?.hesitation_rate || 0)) * 100)}%</strong><span>smooth turns</span></div>
            <div className="stat"><strong>{learner.streak.count}</strong><span>day streak</span></div>
          </div>
          <p className="muted">Last active: {formatDateLabel(learner.streak.last_active)}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="hero">
      <div className="hero-card">
        <span className="eyebrow">Conversation-loop first</span>
        <h1>Speak before fear speaks.</h1>
        <p className="lead">Causerie gets you talking French out loud, every day, without judgment. It keeps the conversation alive when you freeze, then gives a kind debrief after.</p>
        <div className="actions">
          <a className="primary-button" href="#onboarding">Start first rep</a>
          <a className="secondary-button" href="#scenarios">Preview scenarios</a>
        </div>
      </div>
      <form className="card panel" id="onboarding" onSubmit={startOnboarding}>
        <span className="eyebrow">Under 90 seconds to Listening</span>
        <h2>Your first scene</h2>
        <ChoiceGroup label="Why are you learning?" name="persona" value={onboarding.persona} setValue={(persona) => setOnboarding((state) => ({ ...state, persona }))} options={[
          ['immigration', 'Immigration', 'Visa, settlement, exam confidence'],
          ['professional', 'Work', 'Clients, meetings, trade calls'],
          ['other', 'Other', 'General speaking confidence']
        ]} />
        <ChoiceGroup label="Self-placement" name="level" value={onboarding.level} setValue={(level) => setOnboarding((state) => ({ ...state, level }))} options={[
          ['A1', 'I can read simple phrases', 'Tiny and calm'],
          ['A2', 'I can hold a basic chat', 'Recommended starting point'],
          ['B1', 'I can discuss familiar topics', 'Natural follow-ups'],
          ['B2', 'I can explain opinions', 'Faster pace']
        ]} />
        <label className="form-row">
          <span>How nervous are you about speaking French?</span>
          <span className="range-row">
            <input type="range" min="1" max="5" value={onboarding.confidence} onChange={(event) => setOnboarding((state) => ({ ...state, confidence: Number(event.target.value) }))} />
            <strong>{onboarding.confidence}/5</strong>
          </span>
        </label>
        <label className="choice">
          <input type="checkbox" checked={onboarding.consent} onChange={(event) => setOnboarding((state) => ({ ...state, consent: event.target.checked }))} />
          <strong>I consent to local voice/text processing for this MVP.</strong>
          <small>Raw audio is not stored by this app. You can delete local data anytime.</small>
        </label>
        <button className="primary-button" type="submit">Begin speaking</button>
      </form>
    </section>
  );
}

function ChoiceGroup({ label, name, value, setValue, options }) {
  return (
    <div className="form-row">
      <span>{label}</span>
      <div className="choice-grid">
        {options.map(([optionValue, title, description]) => (
          <button key={optionValue} className="choice" type="button" aria-pressed={value === optionValue} onClick={() => setValue(optionValue)}>
            <strong>{title}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function ScenariosPage({ learner, beginConversation }) {
  const currentLearner = learner || createLearner();
  return (
    <section className="card panel">
      <span className="eyebrow">Scenario library</span>
      <h2>Practice the conversations that matter.</h2>
      <p className="lead">Every scene has a concrete goal, CEFR range, and vocabulary focus.</p>
      <div className="scenario-grid">
        {scenarios
          .filter((scenario) => scenario.track === currentLearner.persona || currentLearner.persona === 'other')
          .map((scenario) => (
            <article className="scenario-card" key={scenario.id}>
              <span className="badge">{scenario.track} · {scenario.level_range.join('-')}</span>
              <h3>{scenario.title}</h3>
              <p>{scenario.goal}</p>
              <p className="muted">Focus: {[...scenario.grammar_focus, ...scenario.vocab_focus].slice(0, 4).join(', ')}</p>
              <button className={scenarioMatchesLevel(scenario, currentLearner.effective_level) ? 'primary-button' : 'secondary-button'} type="button" disabled={!learner} onClick={() => beginConversation(scenario.id)}>
                {learner ? 'Practice this' : 'Start onboarding first'}
              </button>
            </article>
          ))}
      </div>
    </section>
  );
}

function ConversationPage({ learner, conversation, partialTranscript, submitTurn, simulateSilence, finishConversation, speakAI, speechRef, showToast, navigate }) {
  const [text, setText] = useState('');
  if (!conversation || !learner) {
    return (
      <section className="card panel">
        <h2>No active conversation yet.</h2>
        <p className="lead">Choose a scenario or start today’s quick rep.</p>
        <button className="primary-button" type="button" onClick={() => navigate('home')}>Start from home</button>
      </section>
    );
  }
  const scenario = getScenario(conversation.scenario_id);
  const listening = conversation.state === LOOP_STATES.LISTENING;
  const lastAi = [...conversation.turns].reverse().find((turn) => turn.speaker === 'ai')?.transcript;

  return (
    <section className="conversation-card">
      <div>
        <div className="scene-header">
          <div>
            <span className="badge">{scenario.track} · {learner.effective_level}</span>
            <h2>{scenario.title}</h2>
            <p className="muted">{scenario.goal}</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => finishConversation('user_ended')}>End</button>
        </div>
        <div className="transcript">
          {conversation.turns.map((turn) => (
            <div className={`bubble ${turn.deadend_rung !== undefined ? 'hint' : turn.speaker}`} key={turn.id}>
              <strong>{turn.speaker === 'ai' ? 'Causerie' : 'You'}</strong><br />
              {turn.transcript}
            </div>
          ))}
          {partialTranscript ? <div className="bubble learner">{partialTranscript}</div> : null}
        </div>
      </div>
      <div className="composer">
        <div className="status-strip">
          <span><span className={`state-dot ${listening ? 'listening' : ''}`} /> {conversation.state}</span>
          <small>{Math.round(getSilenceTimeout(learner.effective_level) / 1000)}s freeze guard</small>
        </div>
        <div className="input-row">
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Type your French if voice is unavailable. Example: Je voudrais ouvrir un compte." />
          <button className="mic-button" type="button" aria-label="Speak French" onClick={() => {
            speechRef.current?.bargeIn();
            if (!speechRef.current?.start()) showToast('Voice input is not available in this browser. Text fallback is ready.');
          }}>Mic</button>
        </div>
        <div className="button-row">
          <button className="primary-button" type="button" onClick={() => { submitTurn(text, 0.95); setText(''); }}>Send turn</button>
          <button className="secondary-button" type="button" onClick={simulateSilence}>I’m stuck</button>
          <button className="secondary-button" type="button" onClick={() => speakAI(lastAi)}>Replay AI</button>
        </div>
      </div>
    </section>
  );
}

function DebriefPage({ debrief, learner, beginConversation, navigate }) {
  if (!debrief) {
    return (
      <section className="card panel">
        <h2>No debrief yet.</h2>
        <p className="lead">Finish a conversation and your strength-first coaching note will appear here.</p>
        <button className="primary-button" type="button" onClick={() => navigate('home')}>Start a rep</button>
      </section>
    );
  }
  return (
    <section className="debrief-card panel">
      <span className="eyebrow">Strength first, correction after</span>
      <h2>Today’s debrief</h2>
      <article className="mini-card">
        <h3>What went well</h3>
        <p>{debrief.opened_with_strength}</p>
      </article>
      <div className="debrief-grid">
        {debrief.top_issues.length ? debrief.top_issues.map((issue) => (
          <article className="issue-card" key={`${issue.type}-${issue.detail}`}>
            <span className="badge">{issue.type}</span>
            <h3>{issue.detail}</h3>
            <p><strong>You said:</strong> {issue.said || 'A hesitation'}</p>
            {issue.model ? <p><strong>Try:</strong> {issue.model}</p> : null}
          </article>
        )) : (
          <article className="issue-card"><h3>No major fixes today.</h3><p>Keep stacking reps. That counts.</p></article>
        )}
      </div>
      <article className="mini-card">
        <h3>One quick win</h3>
        <p>{debrief.quick_win}</p>
      </article>
      <div className="actions">
        <button className="primary-button" type="button" disabled={!learner} onClick={() => beginConversation(pickStarterScenario(learner).id)}>Do another rep</button>
        <button className="secondary-button" type="button" onClick={() => navigate('home')}>View progress</button>
      </div>
    </section>
  );
}
