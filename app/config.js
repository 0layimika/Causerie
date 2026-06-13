export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2'];

export const SILENCE_TIMEOUT_MS = {
  A1: 7000,
  A2: 6000,
  B1: 5000,
  B2: 4000
};

export const ASR_CONFIDENCE_FLOOR = 0.45;

export const DEADEND_LADDER = [
  {
    rung: 0,
    label: 'Patient wait',
    copy: 'Prends ton temps.',
    gloss: 'Take your time.'
  },
  {
    rung: 1,
    label: 'Encourage and narrow',
    copy: 'Pas de souci. Juste un mot : tu préfères le matin ou le soir ?',
    gloss: 'No worries. Just one word: do you prefer morning or evening?'
  },
  {
    rung: 2,
    label: 'Sentence starter',
    copy: 'Tu pourrais commencer par : Je voudrais...',
    gloss: 'You could start with: I would like...'
  },
  {
    rung: 3,
    label: 'Model line',
    copy: 'Par exemple : Je cherche un appartement près du centre. À toi.',
    gloss: 'For example: I am looking for an apartment near the center. Your turn.'
  },
  {
    rung: 4,
    label: 'Graceful simplify',
    copy: 'On va faire plus simple. Réponds avec une phrase courte.',
    gloss: 'We will make it simpler. Answer with a short sentence.'
  },
  {
    rung: 5,
    label: 'Topic pivot',
    copy: 'On y reviendra. Parle-moi plutôt de quelque chose facile pour toi.',
    gloss: 'We will come back to it. Tell me about something easier for you.'
  }
];

export const STUCK_PHRASES = [
  'je ne sais pas',
  'j ne sais pas',
  'comment dire',
  'je ne comprends pas',
  'je comprends pas',
  'euh',
  'heu',
  'how do i say',
  'i do not know',
  "i don't know",
  'i dont know',
  'what should i say',
  'i am stuck',
  "i'm stuck"
];

export const FILLER_WORDS = new Set([
  'euh',
  'heu',
  'um',
  'uh',
  'hmm',
  'mmm',
  'ben',
  'bah',
  'alors'
]);

export const FRENCH_MARKERS = new Set([
  'je',
  'tu',
  'il',
  'elle',
  'nous',
  'vous',
  'ils',
  'elles',
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'du',
  'de',
  'au',
  'aux',
  'et',
  'mais',
  'avec',
  'pour',
  'dans',
  'sur',
  'bonjour',
  'merci',
  'oui',
  'non',
  'voudrais',
  'veux',
  'peux',
  'aller',
  'travail',
  'marché',
  'maison',
  'rendez',
  'vous',
  'parce',
  'que',
  'est',
  'suis',
  'sont'
]);

export const DEFAULT_LEARNER = {
  id: 'local-learner',
  persona: 'immigration',
  level: 'A2',
  effective_level: 'A2',
  tone_setting: 'warm',
  confidence_baseline: 3,
  vocab_seen: [],
  struggle_areas: [],
  streak: { count: 0, last_active: '', saves_remaining: 1 },
  created_at: '',
  reminder_time: ''
};

export const LOOP_STATES = {
  SCENE_SET: 'SceneSet',
  AI_SPEAKING: 'AISpeaking',
  LISTENING: 'Listening',
  CAPTURING: 'Capturing',
  PROCESSING: 'Processing',
  DEADEND_CHECK: 'DeadEndCheck',
  DEBRIEF: 'Debrief'
};
