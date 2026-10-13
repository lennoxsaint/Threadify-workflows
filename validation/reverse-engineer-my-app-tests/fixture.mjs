// Synthetic feature map for a made-up app the owner owns. No real app, account or code.
export const SKILL_SCRIPTS = '../../plugins/threadify/skills/threadify-reverse-engineer-my-app/scripts';

export function reaMap(overrides = {}) {
  const features = [
    ['F1', 'one-tap export', 'turns any board into a PDF from the share menu', { kind: 'rea', script: 'https://app.example.com/assets/index-abc123.js', line: 1, column: 20451, detail: 'route candidate /export' }],
    ['F2', 'dark mode', 'switches the whole app to a dark theme from settings', { kind: 'rea', script: 'https://app.example.com/assets/settings-9f2.js', line: 3, column: 88, detail: 'theme toggle' }],
    ['F3', 'keyboard shortcuts', 'lets you jump between boards with 12 shortcuts', { kind: 'rea', script: 'https://app.example.com/assets/keys-77a.js', line: 1, column: 512 }],
    ['F4', 'offline drafts', 'keeps a draft open in the browser when the network drops', { kind: 'rea', script: 'https://app.example.com/assets/sw.js', line: 40, column: 2 }],
    ['F5', 'templates', 'starts a new board from one of 8 templates', { kind: 'quote', quote: 'start from 8 ready-made templates', from: 'https://app.example.com/' }],
    ['F6', 'comments', 'lets teammates leave a comment on any card', { kind: 'rea', script: 'https://app.example.com/assets/comments-1b.js', line: 2, column: 1400 }],
    ['F7', 'search', 'finds any card by its title as you type', { kind: 'rea', script: 'https://app.example.com/assets/search-c4.js', line: 1, column: 77 }],
    ['F8', 'undo history', 'steps back through your last 50 changes', { kind: 'rea', script: 'https://app.example.com/assets/history-d1.js', line: 9, column: 300 }],
  ].map(([id, name, what, evidence]) => ({ id, name, what, evidence }));
  return {
    app: { name: 'BoardKit', url: 'https://app.example.com' },
    source: 'rea',
    observed_at: '2026-10-13T02:00:00Z',
    features,
    unknowns: ['whether exports are kept after download'],
    limitations: ['static bundle analysis only; server behaviour is not observed'],
    ...overrides,
  };
}

export const PICKS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'];
