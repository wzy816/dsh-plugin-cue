/**
 * Client half of dsh-plugin-cue.
 *
 * The Client already publishes one unified UI status per Session through
 * `ctx.uiSession.sessionStatus` (a Map<SessionId, {running, pendingInteraction,
 * completionUnread}>). This module only listens:
 *
 *   - a top-level Session goes running -> idle  => soft two-note cue ("done")
 *   - a top-level Session gains a pending interaction (approval, question,
 *     plan review)                              => warmer three-note nudge
 *
 * Audio is synthesised with Web Audio, so the bundle ships no sound files.
 */
window.__ModuleLoader__.load({
	id: 'dsh-plugin-cue',
	factory(require) {
		// Service names only; no Harness module is imported.
		const inject = ['sessions', 'uiSession'];

		/** Ignore a second cue inside this window; one chime is enough. */
		const MIN_GAP_MS = 800;
		/** Drop a queued cue the browser could not play within this window. */
		const PENDING_TTL_MS = 5000;
		const SILENCE = 0.0001;

		/** Gentle rising two-note chime: E5 then B5. */
		const DONE_NOTES = [
			{ freq: 659.25, at: 0, dur: 0.42, gain: 0.12, type: 'sine' },
			{ freq: 987.77, at: 0.13, dur: 0.55, gain: 0.11, type: 'sine' },
		];
		/** Brighter three-note alert: A5, A5, D6. */
		const ATTENTION_NOTES = [
			{ freq: 880.0, at: 0, dur: 0.13, gain: 0.15, type: 'triangle' },
			{ freq: 880.0, at: 0.19, dur: 0.13, gain: 0.15, type: 'triangle' },
			{ freq: 1174.66, at: 0.38, dur: 0.22, gain: 0.13, type: 'triangle' },
		];

		const NOTES = { done: DONE_NOTES, attention: ATTENTION_NOTES };

		/** Lazily owned AudioContext plus the unlock/pending-cue policy. */
		function createChime() {
			let audio = null;
			let disposed = false;
			let pendingKind = null;
			let pendingAt = 0;
			let lastPlayedAt = 0;
			const timers = new Set();

			/** Run `fn` after `ms`, tracking the timer for teardown. */
			function later(fn, ms) {
				const id = window.setTimeout(() => {
					timers.delete(id);
					fn();
				}, ms);
				timers.add(id);
				return id;
			}

			/** Create the AudioContext on demand; browsers may keep it suspended. */
			function context() {
				if (disposed) return null;
				if (audio !== null) return audio;
				const Ctor = window.AudioContext || window.webkitAudioContext;
				if (typeof Ctor !== 'function') return null;
				try {
					audio = new Ctor();
				} catch {
					audio = null;
				}
				return audio;
			}

			/** Schedule one cue now. */
			function emit(kind) {
				const ctx = audio;
				const notes = NOTES[kind];
				if (ctx === null || notes === undefined) return;
				const start = ctx.currentTime + 0.02;
				const master = ctx.createGain();
				master.gain.value = 1;
				master.connect(ctx.destination);
				let end = 0;
				for (const note of notes) {
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = note.type;
					osc.frequency.setValueAtTime(note.freq, start + note.at);
					gain.gain.setValueAtTime(SILENCE, start + note.at);
					gain.gain.exponentialRampToValueAtTime(note.gain, start + note.at + 0.012);
					gain.gain.exponentialRampToValueAtTime(SILENCE, start + note.at + note.dur);
					osc.connect(gain);
					gain.connect(master);
					osc.start(start + note.at);
					osc.stop(start + note.at + note.dur + 0.03);
					end = Math.max(end, note.at + note.dur + 0.03);
				}
				later(() => {
					try {
						master.disconnect();
					} catch {
						// the context may already be closed
					}
				}, Math.ceil((end + 0.1) * 1000));
			}

			/** Play a queued cue once the context is allowed to start. */
			function flush() {
				if (disposed || pendingKind === null) return;
				if (Date.now() - pendingAt > PENDING_TTL_MS) {
					pendingKind = null;
					return;
				}
				if (audio === null || audio.state !== 'running') return;
				const kind = pendingKind;
				pendingKind = null;
				lastPlayedAt = Date.now();
				emit(kind);
			}

			return {
				/** Play one cue, or queue it until a user gesture unlocks audio. */
				play(kind) {
					if (disposed) return;
					const now = Date.now();
					if (now - lastPlayedAt < MIN_GAP_MS) return;
					const ctx = context();
					if (ctx === null) return;
					if (ctx.state === 'running') {
						lastPlayedAt = now;
						emit(kind);
						return;
					}
					pendingKind = kind;
					pendingAt = now;
					const resumed = ctx.resume();
					if (resumed && typeof resumed.then === 'function') {
						resumed.then(flush, () => {});
					}
				},
				/** Resume audio from a user gesture and release a fresh queued cue. */
				unlock() {
					const ctx = context();
					if (ctx === null) return;
					if (ctx.state === 'running') {
						flush();
						return;
					}
					const resumed = ctx.resume();
					if (resumed && typeof resumed.then === 'function') {
						resumed.then(flush, () => {});
					}
				},
				/** Release every timer and the AudioContext. */
				dispose() {
					disposed = true;
					pendingKind = null;
					for (const id of timers) window.clearTimeout(id);
					timers.clear();
					if (audio !== null) {
						try {
							audio.close();
						} catch {
							// already closed
						}
						audio = null;
					}
				},
			};
		}

		/**
		 * Watch Session status and turn transitions into cues.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			const chime = createChime();
			/** Last observed `running` per Session id. */
			const running = new Map();
			/** Pending-interaction key already acknowledged per Session id. */
			const pending = new Map();
			/** Skip the first observation: it is the page's current state, not news. */
			let seeded = false;

			const unlock = () => chime.unlock();
			window.addEventListener('pointerdown', unlock, true);
			window.addEventListener('keydown', unlock, true);

			const observe = () => {
				const statuses = ctx.uiSession.sessionStatus.getSnapshot();
				const rows = ctx.sessions.list.getSnapshot().byId;
				const seen = new Set();
				for (const [sessionId, status] of statuses) {
					seen.add(sessionId);
					const row = rows[sessionId];
					// Only top-level Sessions notify: subagent rows finish constantly.
					const topLevel = row !== undefined && row.parentId === undefined && row.origin !== 'subagent';
					const wasRunning = running.get(sessionId) === true;
					const isRunning = status.running === true;
					const interaction = status.pendingInteraction;
					const key = interaction === undefined ? undefined : interaction.key;
					const previousKey = pending.get(sessionId);

					if (seeded && topLevel && status.running !== undefined) {
						if (key !== undefined && key !== previousKey) {
							// A fresh approval/question is blocked on the user.
							chime.play('attention');
						} else if (wasRunning && !isRunning && key === undefined) {
							// The turn settled with nothing left to answer.
							chime.play('done');
						}
					}

					running.set(sessionId, isRunning);
					if (key === undefined) pending.delete(sessionId);
					else pending.set(sessionId, key);
				}
				for (const sessionId of [...running.keys()]) {
					if (!seen.has(sessionId)) running.delete(sessionId);
				}
				for (const sessionId of [...pending.keys()]) {
					if (!seen.has(sessionId)) pending.delete(sessionId);
				}
				seeded = true;
			};

			ctx.effect(() => {
				const stop = ctx.uiSession.sessionStatus.subscribe(observe);
				observe();
				return stop;
			}, 'dsh-plugin-cue: session status');

			ctx.effect(() => () => {
				window.removeEventListener('pointerdown', unlock, true);
				window.removeEventListener('keydown', unlock, true);
				chime.dispose();
			}, 'dsh-plugin-cue: audio resources');
		}

		return { inject, apply };
	},
});
