const IMPACT_SCORE = { low: 1, med: 2, high: 3 };
const FIXABILITY_SCORE = { low: 1, med: 2, high: 3 };

export function generateDebrief(conversation, learner) {
  const capture = conversation.capture || [];
  const positives = capture.filter((event) => event.type === 'strength');
  const issues = capture
    .filter((event) => event.type !== 'strength')
    .sort((a, b) => scoreIssue(b) - scoreIssue(a));

  const topIssues = dedupeIssues(issues).slice(0, 3);
  const quickWinSource = [...topIssues].sort((a, b) => FIXABILITY_SCORE[b.fixability] - FIXABILITY_SCORE[a.fixability])[0];

  return {
    conversation_id: conversation.id,
    opened_with_strength: positives[0]?.detail || fallbackStrength(conversation),
    top_issues: topIssues,
    quick_win: quickWinSource ? quickWinFor(quickWinSource) : 'Demain, garde cette énergie et réponds avec une phrase complète.',
    optional_drills: topIssues.length
      ? [{ kind: 'grammar', target: topIssues[0].struggle_tag || topIssues[0].detail }]
      : [],
    tone: learner.tone_setting || 'warm'
  };
}

function scoreIssue(event) {
  return (IMPACT_SCORE[event.impact] || 1) * (FIXABILITY_SCORE[event.fixability] || 1);
}

function dedupeIssues(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = event.struggle_tag || `${event.type}:${event.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fallbackStrength(conversation) {
  const learnerTurns = conversation.turns.filter((turn) => turn.speaker === 'learner');
  if (learnerTurns.length >= 6) return 'Tu as tenu une vraie conversation avec plusieurs réponses complètes.';
  if (learnerTurns.some((turn) => turn.transcript.split(/\s+/).length >= 6)) return 'Tu as produit une réponse complète sans abandonner la phrase.';
  return 'Tu as commencé à parler à voix haute, et c’est exactement la première victoire.';
}

function quickWinFor(event) {
  if (event.model) return `La prochaine fois, dis simplement : ${event.model}.`;
  if (event.type === 'hesitation') return 'Quand tu bloques, commence par une phrase courte : Je pense que...';
  if (event.type === 'vocab_gap') return `Réutilise ce mot demain : ${event.detail}.`;
  return `Concentre-toi sur ${event.detail} dans la prochaine conversation.`;
}
