import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, ArrowUp, ArrowUpRight, Camera, ChevronRight,
  Eye, Gamepad2, Menu, MoveHorizontal, ScanFace, Settings, ShieldCheck,
  Target, Trophy, X,
} from 'lucide-react';
import { Artwork } from './Artwork.jsx';
import { Calibration } from './Calibration.jsx';
import { defaultSensitivity } from './gestureEngine.js';
import { BlinkRunner } from './runner/BlinkRunner.jsx';
import { FaceRacer } from './racer/FaceRacer.jsx';
import { SpaceFace } from './space/SpaceFace.jsx';
import { useSavedRuns } from './useSavedRuns.js';
import { dailyChallenge } from './progress.js';
import { Onboarding, Privacy, ProgressPage } from './Product.jsx';
import { downloadScoreCard } from './scoreCard.js';
import './style.css';
import './calibration.css';

const pages = {
  home: 'Home', games: 'Games', calibration: 'Calibration', leaderboard: 'Leaderboard',
  progress: 'Progress', 'how-it-works': 'How It Works', settings: 'Settings',
};
const arcadePages = { 'blink-runner': 'Blink Runner', 'face-racer': 'Face Racer', spaceface: 'SpaceFace' };

const games = [
  { id: 'runner', title: 'Blink Runner', genre: 'ENDLESS RUNNER', control: 'Blink to jump', icon: Eye, href: '#blink-runner' },
  { id: 'racer', title: 'Face Racer', genre: 'RACING', control: 'Tilt to steer', icon: MoveHorizontal, href: '#face-racer' },
  { id: 'space', title: 'SpaceFace', genre: 'SPACE SURVIVAL', control: 'Tilt, open mouth, smile', icon: Target, href: '#spaceface' },
];

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function currentLocation() {
  const hash = window.location.hash.slice(1);
  if (hash.endsWith('/daily')) {
    const challenge = dailyChallenge();
    return hash === `${challenge.route}/daily` ? { page: challenge.route, challenge } : { page: 'progress' };
  }
  return { page: Object.hasOwn(pages, hash) || Object.hasOwn(arcadePages, hash) || hash === 'privacy' ? hash : 'home' };
}

function Brand() {
  return <a className="brand" href="#home" aria-label="FaceControl home"><span className="brand-mark"><ScanFace size={20} /></span><span>Face<span className="brand-accent">Control</span></span></a>;
}

function Header({ page }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef(null);
  useEffect(() => { setMenuOpen(false); }, [page]);

  return <header className="site-header">
    <div className="header-inner" onKeyDown={event => { if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menu.current.focus(); } }}>
      <Brand />
      <button ref={menu} className="menu-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="navigation">{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
      <nav id="navigation" aria-label="Main navigation" className={menuOpen ? 'nav open' : 'nav'} onClick={() => setMenuOpen(false)}>
        {Object.entries(pages).map(([id, label]) => <a key={id} href={`#${id}`} aria-current={id === page ? 'page' : id === 'games' && Object.hasOwn(arcadePages, page) ? 'location' : undefined}>{label}</a>)}
      </nav>
      <span className="header-status"><span /> LOCAL ARCADE</span>
    </div>
  </header>;
}

function GameCard({ game }) {
  const Icon = game.icon;
  return <article className={`game-card ${game.id}`}>
    <a className="game-button" href={game.href} aria-label={`Play ${game.title}`}>
      <div className="game-art">
        <Artwork variant={game.id} />
        <span className="game-available">Play now</span>
      </div>
      <div className="game-info">
        <div className="game-genre">{game.genre}</div>
        <h3>{game.title}</h3>
        <div className="game-control"><Icon size={15} /> {game.control}</div>
        <span className="game-arrow"><ArrowUpRight size={19} /></span>
      </div>
    </a>
  </article>;
}

function GameGrid() {
  return <div className="game-grid">{games.map(game => <GameCard key={game.id} game={game} />)}</div>;
}

function Home() {
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-line" /> THE HANDS-FREE ARCADE</div>
        <h1 id="hero-title">Your Face.<br /><span>Your Controller.</span></h1>
        <p>Jump over barriers, weave through traffic, and blast asteroids using facial gestures and your webcam.</p>
        <div className="hero-actions">
          <a href="#games" className="button primary"><Gamepad2 size={19} /> Explore Games <ArrowRight size={17} /></a>
          <a href="#progress" className="button secondary">Daily Challenge <ArrowUpRight size={17} /></a>
        </div>
        <div className="privacy-note"><ShieldCheck size={15} /> Camera access is optional and stays on your device</div>
      </div>
      <div className="hero-visual" aria-hidden="true"><Artwork variant="hero" /><span className="visual-label">GESTURE INPUT <span> / </span> CONCEPT</span></div>
    </section>
    <section className="library-section" aria-labelledby="game-library-title">
      <div className="section-head">
        <div><div className="eyebrow"><span className="eyebrow-line" /> THE ARCADE</div><h2 id="game-library-title">Game library</h2></div>
        <a href="#games" className="text-link">View all games <ArrowRight size={17} /></a>
      </div>
      <GameGrid />
    </section>
    <section className="privacy-band"><div className="panel-icon"><ShieldCheck size={23} /></div><div><h2>Designed for local processing</h2><p>FaceControl processes webcam video on your device.</p></div><a href="#privacy" className="text-link">Webcam privacy <ArrowUpRight size={16} /></a></section>
  </>;
}

function PageIntro({ title, description, parent = 'home' }) {
  return <div className="page-intro"><a href={`#${parent}`} className="breadcrumb">{pages[parent]} <ChevronRight size={14} /></a><h1>{title}</h1><p>{description}</p></div>;
}

function Leaderboard() {
  const [filter, setFilter] = useState('all');
  const [downloadError, setDownloadError] = useState('');
  const entries = useSavedRuns().filter(entry => entry.completed !== false && games.some(game => game.id === entry.gameId));
  const scores = entries.filter(entry => filter === 'all' || entry.gameId === filter).sort((a, b) => b.score - a.score);
  function download(entry) {
    setDownloadError('');
    try { downloadScoreCard(entry); }
    catch { setDownloadError('The score card could not be downloaded. Your saved score is still available.'); }
  }

  return <>
    <PageIntro title="Leaderboard" description="High scores are saved in this browser." />
    <div className="panel score-panel">
      <div className="score-filter" role="group" aria-label="Filter scores by game">{[{ id: 'all', title: 'All games' }, ...games].map(game => <button key={game.id} type="button" aria-pressed={filter === game.id} onClick={() => setFilter(game.id)}>{game.title}</button>)}</div>
      {scores.length > 0 ? <div className="score-table"><table><thead><tr><th scope="col">Rank</th><th scope="col">Game</th><th scope="col">Score</th><th scope="col">Score card</th></tr></thead><tbody>{scores.map((entry, index) => <tr key={index}><td>{index + 1}</td><td>{games.find(game => game.id === entry.gameId).title}</td><td>{entry.score.toLocaleString()}</td><td><button className="score-download" type="button" aria-label={`Download score card for rank ${index + 1}`} onClick={() => download(entry)}>Download</button></td></tr>)}</tbody></table></div>
        : <div className="empty-state" aria-live="polite"><div className="panel-icon"><Trophy size={25} /></div><h2>No scores yet</h2><p>Finish a run to record a score.</p><a href="#games" className="text-link">Choose a game <ArrowRight size={16} /></a></div>}
    </div>
    {downloadError && <p className="camera-error" role="status">{downloadError}</p>}
  </>;
}

function HowItWorks() {
  const steps = [
    { icon: Camera, title: 'Allow webcam access', description: 'Go to Calibration and choose Start Camera. Allow access if your browser asks.' },
    { icon: ScanFace, title: 'Calibrate your gestures', description: 'Record a relaxed face and five example movements. Then use the live indicators to check which gestures the camera recognizes.' },
    { icon: Gamepad2, title: 'Play hands-free', description: 'Blink to jump in Blink Runner, tilt to steer in Face Racer, or tilt, open your mouth, and smile to fly, shoot, and blast in SpaceFace.' },
  ];
  return <>
    <PageIntro title="How it works" description="Practice your gestures in Calibration, then choose a game." />
    <div className="how-grid">{steps.map(({ icon: Icon, title, description }) => <article className="panel how-card" key={title}><div className="panel-icon"><Icon size={24} /></div><h2>{title}</h2><p>{description}</p></article>)}</div>
    <Privacy />
  </>;
}

function SettingsPage({ motion, onMotionChange, sensitivity, onSensitivityChange, saved, onShowGuide }) {
  return <>
    <PageIntro title="Settings" description="Manage your preferences for this browser." />
    <div className="panel settings-panel">
      <div className="setting-row"><div className="panel-icon"><Settings size={22} /></div><div><h2><label htmlFor="reduced-motion">Reduce motion</label></h2><p>Turn off interface animations and transitions.</p></div><input className="switch" id="reduced-motion" type="checkbox" role="switch" checked={motion} onChange={event => onMotionChange(event.target.checked)} /></div>
      <div className="setting-row"><div className="panel-icon"><ScanFace size={22} /></div><div><h2><label htmlFor="settings-sensitivity">Gesture sensitivity</label></h2><p>Higher sensitivity detects smaller movements.</p></div><div className="settings-sensitivity"><input id="settings-sensitivity" className="sensitivity-slider" type="range" min="0" max="100" value={sensitivity} onChange={event => onSensitivityChange(Number(event.target.value))} /><output htmlFor="settings-sensitivity">{sensitivity}%</output></div></div>
      <div className="setting-row"><div className="panel-icon"><Gamepad2 size={22} /></div><div><h2>Getting started</h2><p>Review camera, calibration, and control options.</p></div><button type="button" className="button secondary" onClick={onShowGuide}>Open guide</button></div>
    </div>
    {!saved && <p role="status">Your browser couldn’t save this preference for future visits.</p>}
  </>;
}

function App() {
  const [{ page, challenge }, setLocation] = useState(currentLocation);
  const [guide, setGuide] = useState(() => page === 'home' && readLocal('facecontrol.onboarded', false) !== true);
  const [motion, setMotion] = useState(() => readLocal('facecontrol.reduceMotion', false) === true);
  const [sensitivity, setSensitivity] = useState(() => {
    const value = readLocal('facecontrol.sensitivity', defaultSensitivity);
    return Number.isInteger(value) && value >= 0 && value <= 100 ? value : defaultSensitivity;
  });
  const [profile, setProfile] = useState(null);
  const [blinkSensitivity, setBlinkSensitivity] = useState(() => {
    const value = readLocal('facecontrol.blinkSensitivity', null);
    return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
  });
  const [tiltSensitivity, setTiltSensitivity] = useState(() => {
    const value = readLocal('facecontrol.tiltSensitivity', null);
    return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
  });
  const [spaceSensitivity, setSpaceSensitivity] = useState(() => {
    const value = readLocal('facecontrol.spaceSensitivity', null);
    return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
  });
  const [storageErrors, setStorageErrors] = useState({});
  const main = useRef(null);
  useEffect(() => {
    function navigate() {
      setLocation(currentLocation());
      window.scrollTo(0, 0);
      main.current.focus({ preventScroll: true });
    }
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    document.title = page === 'home' ? 'FaceControl — Your Face. Your Controller.' : `${arcadePages[page] ?? pages[page] ?? 'Privacy'} | FaceControl`;
  }, [page]);
  function savePreference(key, value) {
    let failed = false;
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { failed = true; }
    setStorageErrors(previous => ({ ...previous, [key]: failed }));
  }

  function changeMotion(value) {
    setMotion(value);
    savePreference('facecontrol.reduceMotion', value);
  }

  function changeSensitivity(value) {
    setSensitivity(value);
    savePreference('facecontrol.sensitivity', value);
  }

  function changeBlinkSensitivity(value) {
    setBlinkSensitivity(value);
    savePreference('facecontrol.blinkSensitivity', value);
  }

  function changeTiltSensitivity(value) {
    setTiltSensitivity(value);
    savePreference('facecontrol.tiltSensitivity', value);
  }

  function changeSpaceSensitivity(value) {
    setSpaceSensitivity(value);
    savePreference('facecontrol.spaceSensitivity', value);
  }

  function dismissGuide() {
    if (!guide) return;
    setGuide(false);
    savePreference('facecontrol.onboarded', true);
  }

  return <div className={motion ? 'app reduced-motion' : 'app'}>
    <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); main.current.focus(); }}>Skip to content</a>
    <Header page={page} />
    <main ref={main} id="main-content" tabIndex={-1} className={`main wrap${Object.hasOwn(arcadePages, page) ? ' game-page' : ''}`}>
      {page === 'home' && <Home />}
      {page === 'games' && <><PageIntro title="Game library" description="Three games, each with a different way to play hands-free." /><GameGrid /></>}
      {page === 'blink-runner' && <><PageIntro title="Blink Runner" description="Jump over neon barriers and see how long you can keep running." parent="games" /><BlinkRunner key={challenge?.id ?? 'standard'} challenge={challenge} profile={profile} sensitivity={blinkSensitivity ?? sensitivity} onSensitivityChange={changeBlinkSensitivity} reducedMotion={motion} /></>}
      {page === 'face-racer' && <><PageIntro title="Face Racer" description="Dodge traffic, collect coins, and keep going as the road gets faster." parent="games" /><FaceRacer key={challenge?.id ?? 'standard'} challenge={challenge} profile={profile} sensitivity={tiltSensitivity ?? sensitivity} onSensitivityChange={changeTiltSensitivity} reducedMotion={motion} /></>}
      {page === 'spaceface' && <><PageIntro title="SpaceFace" description="Pilot a neon ship through asteroid waves and charge your energy blast." parent="games" /><SpaceFace key={challenge?.id ?? 'standard'} challenge={challenge} profile={profile} sensitivity={spaceSensitivity ?? sensitivity} onSensitivityChange={changeSpaceSensitivity} reducedMotion={motion} /></>}
      {page === 'calibration' && <><PageIntro title="Calibration" description="Set up your webcam, calibrate your gestures, and see them detected live." /><Calibration profile={profile} onProfileChange={setProfile} sensitivity={sensitivity} onSensitivityChange={changeSensitivity} /></>}
      {page === 'leaderboard' && <Leaderboard />}
      {page === 'progress' && <><PageIntro title="Your progress" description="See your records, earn achievements, and take on the daily challenge." /><ProgressPage /></>}
      {page === 'privacy' && <><PageIntro title="Privacy" description="What FaceControl uses and what your browser saves." /><Privacy /></>}
      {page === 'how-it-works' && <HowItWorks />}
      {page === 'settings' && <SettingsPage motion={motion} onMotionChange={changeMotion} sensitivity={sensitivity} onSensitivityChange={changeSensitivity} saved={!Object.values(storageErrors).some(Boolean)} onShowGuide={() => setGuide(true)} />}
    </main>
    <footer className="site-footer"><div className="wrap footer-inner"><Brand /><a href="#privacy" className="text-link">Privacy</a><a href="#home" className="footer-home" aria-label="Back to home"><ArrowUp size={17} /></a></div></footer>
    <Onboarding open={guide} onClose={dismissGuide} />
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);

if (import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(error => {
    console.warn('FaceControl could not register its installable app worker.', error);
  });
}
