export const scenarios = [
  {
    id: 'immigration-visa-a2',
    track: 'immigration',
    title: 'Visa officer interview',
    level_range: ['A1', 'B1'],
    goal: 'Explain why you want to move and answer two follow-up questions.',
    grammar_focus: ['present tense', 'because clauses'],
    vocab_focus: ['visa', 'work', 'family', 'city'],
    opener: 'Bonjour. Pourquoi voulez-vous apprendre le français pour votre projet ?',
    prompts: [
      'Pourquoi le français est important pour vous ?',
      'Parlez-moi de votre travail ou de vos études.',
      'Dans quelle ville aimeriez-vous vivre ?',
      'Qu’est-ce qui vous rend confiant pour ce projet ?'
    ]
  },
  {
    id: 'immigration-apartment-a1',
    track: 'immigration',
    title: 'Renting an apartment',
    level_range: ['A1', 'A2'],
    goal: 'Ask about location, price, and one visit time.',
    grammar_focus: ['je voudrais', 'questions with est-ce que'],
    vocab_focus: ['appartement', 'loyer', 'quartier', 'visite'],
    opener: 'Bonjour, vous cherchez quel type d’appartement ?',
    prompts: [
      'Vous préférez un quartier calme ou animé ?',
      'Quel est votre budget pour le loyer ?',
      'Quand voulez-vous faire une visite ?'
    ]
  },
  {
    id: 'immigration-bank-a2',
    track: 'immigration',
    title: 'Opening a bank account',
    level_range: ['A1', 'B1'],
    goal: 'State what you need and ask about documents.',
    grammar_focus: ['polite requests', 'need + infinitive'],
    vocab_focus: ['compte', 'document', 'adresse', 'carte'],
    opener: 'Bonjour. Vous voulez ouvrir quel type de compte aujourd’hui ?',
    prompts: [
      'Quels documents avez-vous avec vous ?',
      'Vous voulez une carte bancaire aussi ?',
      'Avez-vous une adresse locale ?'
    ]
  },
  {
    id: 'professional-client-b1',
    track: 'professional',
    title: 'Client kickoff call',
    level_range: ['A2', 'B2'],
    goal: 'Introduce yourself, confirm the objective, and agree on next steps.',
    grammar_focus: ['future proche', 'clarifying questions'],
    vocab_focus: ['objectif', 'délai', 'prochaine étape', 'réunion'],
    opener: 'Bonjour, ravi de vous rencontrer. Quel est l’objectif principal du projet ?',
    prompts: [
      'Quel résultat voulez-vous obtenir cette semaine ?',
      'Qui doit valider la prochaine étape ?',
      'Quand pouvons-nous faire le point ?'
    ]
  },
  {
    id: 'professional-negotiation-b1',
    track: 'professional',
    title: 'Price negotiation',
    level_range: ['A2', 'B2'],
    goal: 'Negotiate price politely and propose a compromise.',
    grammar_focus: ['conditional polite forms', 'comparison'],
    vocab_focus: ['prix', 'réduction', 'budget', 'accord'],
    opener: 'Merci pour votre proposition. Le prix est un peu élevé pour notre budget.',
    prompts: [
      'Quelle réduction pouvez-vous proposer ?',
      'Qu’est-ce qui est inclus dans ce prix ?',
      'Pouvez-vous proposer un compromis ?'
    ]
  },
  {
    id: 'professional-status-a2',
    track: 'professional',
    title: 'Status update',
    level_range: ['A1', 'B1'],
    goal: 'Give a concise update on progress, blocker, and next action.',
    grammar_focus: ['passé composé', 'near future'],
    vocab_focus: ['terminé', 'bloqué', 'demain', 'envoyer'],
    opener: 'Bonjour. Où en est le projet aujourd’hui ?',
    prompts: [
      'Qu’est-ce que vous avez terminé ?',
      'Est-ce qu’il y a un blocage ?',
      'Quelle est la prochaine étape ?'
    ]
  }
];

export function scenarioMatchesLevel(scenario, level) {
  const order = ['A1', 'A2', 'B1', 'B2'];
  const [min, max] = scenario.level_range;
  const value = order.indexOf(level);
  return value >= order.indexOf(min) && value <= order.indexOf(max);
}

export function getScenario(id) {
  return scenarios.find((scenario) => scenario.id === id) || scenarios[0];
}

export function pickStarterScenario(learner) {
  const track = learner.persona === 'professional' ? 'professional' : 'immigration';
  return scenarios.find((scenario) => scenario.track === track && scenarioMatchesLevel(scenario, learner.effective_level)) || scenarios[0];
}
