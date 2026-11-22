import '@fontsource/cinzel/600.css';
import '@fontsource/crimson-pro/400.css';
import '@fontsource/pixelify-sans/400.css';
import { VersusApp } from './hapa/presentation/app.js';

const app = new VersusApp(document.getElementById('app'));
const q = new URLSearchParams(location.search);
if (q.has('autostart')) {
  app.startMatch({
    fixture: q.get('fixture') ?? null,
    profileId: q.get('profile') ?? undefined,
    seats: { A: q.get('a') ?? 'human', B: q.get('b') ?? 'bot' },
    seed: Number(q.get('seed') ?? 1),
  });
}
if (q.has('debug') || q.has('autostart')) window.__versus = app;
