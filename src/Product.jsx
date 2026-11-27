import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Gamepad2, ShieldCheck, Trophy } from 'lucide-react';
import { achievements, challengeStatus, dailyChallenge, formatPlaytime, gameDetails, summarizeRuns } from './progress.js';
import { useSavedRuns } from './useSavedRuns.js';
import './product.css';

export function Onboarding({ open, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  return <dialog ref={dialog} className="product-dialog" aria-labelledby="onboarding-title" onClose={onClose}>
    <h2 id="onboarding-title">Welcome to FaceControl</h2>
    <p>Choose how you want to play. You can change controls in any game.</p>
    <div className="onboarding-steps">
      <div><Camera size={20} aria-hidden="true" /><p><strong>1. Choose camera or manual controls</strong>Camera access starts only when you request it. Keyboard and touch are available in all three games.</p></div>
      <div><ShieldCheck size={20} aria-hidden="true" /><p><strong>2. Calibrate if you use the camera</strong>Face the webcam and follow the prompts to help FaceControl recognize your gestures.</p></div>
      <div><Gamepad2 size={20} aria-hidden="true" /><p><strong>3. Try a game</strong>Blink to jump, tilt to steer, or open your mouth to fire in SpaceFace. Smile to use a charged blast.</p></div>
    </div>
    <div className="product-actions">
      <a className="button primary" href="#calibration" onClick={onClose}>Try calibration <ArrowRight size={16} /></a>
      <a className="button secondary" href="#games" onClick={onClose}>Play without camera</a>
      <button className="button secondary" type="button" onClick={onClose} autoFocus>Close</button>
    </div>
  </dialog>;
}

export function Privacy() {
  return <section className="panel product-panel privacy-details" aria-labelledby="privacy-title">
    <h2 id="privacy-title"><ShieldCheck size={22} aria-hidden="true" /> Webcam and privacy</h2>
    <ul>
      <li>The camera is optional. FaceControl asks for camera permission when you select Start Camera or Enable camera. It requests video only.</li>
      <li>MediaPipe analyzes frames in your browser. FaceControl never uploads or saves images, video, or landmark data. Calibration stays in this tab’s memory, and leaving a camera screen releases the stream.</li>
      <li>The browser downloads public model files. If the site has no local model copy, it downloads the same model from Google. This request contains no webcam data.</li>
      <li>Scores, playtime, challenge progress, and preferences are stored in this browser. Downloaded score cards contain game results only.</li>
    </ul>
  </section>;
}

export function ProgressPage() {
  const [challenge, setChallenge] = useState(dailyChallenge);
  useEffect(() => {
    let timeout;
    function refreshChallenge() {
      clearTimeout(timeout);
      const now = new Date();
      const next = dailyChallenge(now);
      setChallenge(previous => previous.id === next.id ? previous : next);
      const midnight = new Date(now).setUTCHours(24, 0, 0, 0);
      timeout = setTimeout(refreshChallenge, midnight - now);
    }
    refreshChallenge();
    window.addEventListener('focus', refreshChallenge);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('focus', refreshChallenge);
    };
  }, []);
  const runs = useSavedRuns();
  const stats = summarizeRuns(runs);
  const daily = challengeStatus(challenge, runs);
  return <div className="product-grid">
    <section className="panel product-panel daily-panel" aria-labelledby="daily-title">
      <div className="section-kicker"><span className="eyebrow-line" /> DAILY CHALLENGE</div>
      <h2 id="daily-title">{challenge.title}</h2>
      <p>Finish a run with at least <strong>{challenge.target.toLocaleString()} points</strong>. The date sets the game, the target, and the starting seed for the course.</p>
      <div className="daily-info"><span>{challenge.id} UTC</span><span>{daily.complete ? 'Target reached' : daily.attempts ? `Your best: ${daily.best.toLocaleString()}` : 'No attempts yet'}</span></div>
      <div className="product-actions"><a className="button primary" href={`#${challenge.route}/daily`}>Play daily challenge <ArrowRight size={16} /></a></div>
    </section>
    <section className="panel product-panel" aria-labelledby="stats-title">
      <h2 id="stats-title">Personal statistics</h2>
      <dl className="stat-strip"><div><dt>Runs played</dt><dd>{stats.played}</dd></div><div><dt>Finished</dt><dd>{stats.completed}</dd></div><div><dt>Playtime</dt><dd>{formatPlaytime(stats.seconds)}</dd></div></dl>
      <ul className="record-list">{Object.entries(stats.games).map(([id, record]) => <li key={id}><span>{gameDetails[id].title}</span><strong>{record.completed ? record.best.toLocaleString() : '—'}</strong></li>)}</ul>
      <p className="product-note">{stats.hasUnknownTime ? 'Older runs count toward scores and runs played. Their playtime is unavailable.' : 'Playtime includes active gameplay and excludes pauses and countdowns.'}</p>
    </section>
    <section className="panel product-panel achievement-panel" aria-labelledby="achievements-title">
      <h2 id="achievements-title">Achievements</h2>
      <ul className="achievement-list">{achievements.map(item => {
        const earned = item.earned(stats);
        return <li key={item.id} data-earned={earned}><Trophy size={18} aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.description}</small></span><span className="achievement-status">{earned ? 'Unlocked' : 'Locked'}</span></li>;
      })}</ul>
    </section>
  </div>;
}
