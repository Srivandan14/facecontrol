import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInputHolds } from '../src/arcade/inputHolds.js';
import { releaseCameraSession, stopTracks } from '../src/cameraSession.js';
import { achievements, challengeStatus, dailyChallenge, formatPlaytime, seededRandom, summarizeRuns } from '../src/progress.js';
import { createRace } from '../src/racer/engine.js';
import { createRunner } from '../src/runner/engine.js';
import { scoreCardLines } from '../src/scoreCard.js';
import { highScore, readRuns, readScores, saveRun } from '../src/scores.js';
import { createSpace } from '../src/space/engine.js';

function browserStorage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key, next) => { value = next; } };
}

test('daily game, score target and seed are stable for the UTC day and rotate at UTC midnight', () => {
  const day = dailyChallenge(new Date('2026-11-26T00:00:00Z'));
  assert.deepEqual(day, dailyChallenge(new Date('2026-11-27T04:45:00+05:30')));
  const tomorrow = dailyChallenge(new Date('2026-11-27T00:00:00Z'));
  assert.notEqual(day.gameId, tomorrow.gameId);
  assert.notEqual(day.seed, tomorrow.seed);
  assert.ok(day.target > 0);
});

test('the same challenge seed reproduces initial patterns in all three engines', () => {
  const create = (factory, seed) => {
    const { random, ...world } = factory(seededRandom(seed)).world;
    return world;
  };
  for (const factory of [createRunner, createRace, createSpace]) {
    assert.deepEqual(create(factory, 20261127), create(factory, 20261127));
    assert.notDeepEqual(create(factory, 20261127), create(factory, 20270219));
  }
});

test('only a finished daily run for the matching game and date can meet the target', () => {
  const challenge = dailyChallenge(new Date('2026-11-27T00:00:00Z'));
  const run = { gameId: challenge.gameId, score: challenge.target, challengeId: challenge.id };
  const rejected = [{ ...run, completed: false }, { ...run, gameId: 'wrong' }, { ...run, challengeId: undefined }, { ...run, challengeId: '2026-11-26' }];
  assert.deepEqual(challengeStatus(challenge, rejected), { attempts: 0, best: 0, complete: false });
  assert.deepEqual(challengeStatus(challenge, [...rejected, run]), { attempts: 1, best: challenge.target, complete: true });
});

test('legacy runs and abandoned playtime survive reload while leaderboards keep finished scores', () => {
  const storage = browserStorage(JSON.stringify([{ gameId: 'racer', score: 24 }, { gameId: 'runner', score: 5 }]));
  const result = saveRun({ gameId: 'runner', score: 900, completed: false, seconds: 28.5 }, storage);
  assert.deepEqual(result, { high: 5, record: false, saved: true });
  saveRun({ gameId: 'space', score: 70, seconds: 90 }, storage);
  const stats = summarizeRuns(readRuns(storage));
  assert.equal(stats.played, 4);
  assert.equal(stats.completed, 3);
  assert.equal(stats.seconds, 118.5);
  assert.equal(stats.hasUnknownTime, true);
  assert.equal(highScore('runner', readScores(storage)), 5);
  assert.equal(achievements.find(item => item.id === 'trio').earned(stats), true);
});

test('malformed history and invalid optional fields never block new scores', () => {
  const storage = browserStorage('{malformed');
  assert.deepEqual(readRuns(storage), []);
  assert.equal(saveRun({ gameId: 'space', score: 100, seconds: -1, challengeId: '2026-02-30', webcam: 'discard' }, storage).saved, true);
  assert.deepEqual(readRuns(storage), [{ gameId: 'space', score: 100 }]);
  assert.equal(saveRun({ gameId: 'space', score: NaN }, storage).saved, false);
  assert.equal(saveRun({ gameId: 'space', score: 110 }, { ...storage, setItem() { throw Error('quota'); } }).saved, false);
});

test('daily achievements count unique dates and playtime excludes unknown historical durations', () => {
  const challenge = dailyChallenge(new Date('2026-11-27T00:00:00Z'));
  const run = { gameId: challenge.gameId, score: challenge.target, challengeId: challenge.id, seconds: 150 };
  const stats = summarizeRuns([run, run, { gameId: 'runner', score: 4 }]);
  assert.equal(stats.dailyCompleted, 1);
  assert.deepEqual(achievements.filter(item => item.earned(stats)).map(item => item.id), ['first', 'time', 'daily']);
  assert.equal(formatPlaytime(stats.seconds), '5m 0s');
});

test('score card content contains gameplay values and leaves out unrelated information', () => {
  assert.deepEqual(scoreCardLines({ gameId: 'runner', score: 50, seconds: 65, challengeId: '2026-11-27', webcam: 'ignored', localName: 'ignored' }), ['Blink Runner', '50', '1m 5s playtime', 'Daily challenge 2026-11-27 UTC']);
  assert.throws(() => scoreCardLines({ gameId: 'runner', score: 50, completed: false }));
});

test('keyboard and multi-touch holds clear safely on cancellation and overlapping controls', () => {
  const changes = [];
  const holds = createInputHolds((input, held) => changes.push([input, held]));
  holds.press('key:KeyA', 'left');
  holds.press('key:KeyA', 'left');
  holds.press('pointer:1', 'left');
  holds.press('pointer:2', 'fire');
  holds.release('key:KeyA');
  assert.deepEqual(changes, [['left', true], ['fire', true]]);
  holds.release('pointer:1');
  holds.clear();
  holds.release('pointer:2');
  assert.deepEqual(changes, [['left', true], ['fire', true], ['left', false], ['fire', false]]);
});

test('camera cleanup aborts startup, stops tracks, detaches preview and clears a scheduled frame', () => {
  const calls = [];
  const track = { stop: () => calls.push('stop'), removeEventListener: () => calls.push('detach') };
  const stream = { getTracks: () => [track] };
  const abort = new AbortController();
  const video = { srcObject: stream, pause: () => calls.push('pause') };
  releaseCameraSession({ abort, frame: 1, track, ended() {}, stream, video,
    canvas: { width: 160, height: 120, getContext: () => ({ clearRect: (...bounds) => calls.push(bounds) }) },
    detector: { close: () => { calls.push('close'); throw Error('already closed'); } },
  }, id => calls.push(id));
  assert.deepEqual(calls, [1, 'detach', 'stop', 'pause', [0, 0, 160, 120], 'close']);
  assert.equal(abort.signal.aborted, true);
  assert.equal(video.srcObject, null);
  stopTracks(stream);
  assert.equal(calls.at(-1), 'stop');
});
