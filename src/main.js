/* ═══════════════════════════════════════════════════════════════
   DEAD FREQUENCIES — Transmission Experience Engine
   State Machine: gate → sigmap → (panel) → finale
   Interaction: TAP node → open panel → HOLD to unlock signal
   Audio: Native <audio> element with per-track MP3 previews
   ═══════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const DEBUG = true;
  function log() {
    if (DEBUG) console.log("[DF]", ...arguments);
  }

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ── Track data ─────────────────────────────────────────── */
  const TRACKS = {
    1: {
      number: "01", title: "Static Signals",
      phase: "Phase: Interference", status: "SIGNAL DETECTED",
      signal: 6, pct: "78%", color: "cold",
      body: "The first glitches appear. The world feels off — systems flicker, structures crack. Something beneath the surface is starting to fail.",
      fragment: '"the screens keep splitting / nothing holds its shape"',
      audio: { src: "audio/static-signals.mp3", start: 36, end: 49 },
    },
    2: {
      number: "02", title: "Drown Tonight",
      phase: "Phase: Submersion", status: "SIGNAL DEGRADING",
      signal: 4, pct: "54%", color: "warm",
      body: "The collapse turns inward. Noise and pressure overwhelm until breathing through the disconnection feels impossible.",
      fragment: '"sinking past the frequency / where voices used to reach"',
      audio: { src: "audio/drown-tonight.mp3", start: 82, end: 100 },
    },
    3: {
      number: "03", title: "Ghost",
      phase: "Phase: Fracture", status: "IDENTITY FRAGMENTED",
      signal: 3, pct: "32%", color: "ghost",
      body: "Still physically present, but mentally absent. Identity fractures until the self becomes a ghost inside its own life.",
      fragment: '"i\'m standing right here / but nothing registers"',
      audio: { src: "audio/ghost.mp3", start: 11, end: 21 },
    },
    4: {
      number: "04", title: "Neon Graves",
      phase: "Phase: Collapse", status: "SIGNAL LOST",
      signal: 1, pct: "08%", color: "critical",
      body: "Total breakdown. Dead lights and lost signals turn the city into a graveyard of everything that once felt stable.",
      fragment: '"every light that burned is now a monument to what we lost"',
      audio: { src: "audio/neon-graves.mp3", start: 90, end: 113 },
    },
    5: {
      number: "05", title: "Light The Fire",
      phase: "Phase: Defiance", status: "SIGNAL OVERRIDE",
      signal: 4, pct: "MANUAL", color: "ember",
      body: "A moment of defiance. Instead of waiting for the system to recover, the protagonist breaks free from it.",
      fragment: '"burn the protocol / override the silence"',
      audio: { src: "audio/light-the-fire.mp3", start: 36, end: 49 },
    },
    6: {
      number: "06", title: "We Remain",
      phase: "Phase: Survival", status: "SIGNAL PERSISTS",
      signal: 8, pct: "HUMAN", color: "resolve",
      body: "Silence settles after the collapse. The world is scarred and broken, but something human survives — and keeps transmitting.",
      fragment: '"after everything / we are still here / still transmitting"',
      audio: { src: "audio/we-remain.mp3", start: 101, end: 112 },
    },
  };

  /* ── State ──────────────────────────────────────────────── */
  const state = {
    soundOn: false,
    explored: new Set(),
    panelOpen: false,
    panelTrackId: null,
    currentState: "gate",
    holding: false,
    finaleReady: false,
    finaleStabilised: false,
    activeTrack: null,
  };

  /* ── DOM ────────────────────────────────────────────────── */
  const html = document.documentElement;
  const gateLines = $$(".gate__line");
  const gateControls = $(".gate__controls");
  const gateHoldZone = $("#gate-hold");
  const gateProgress = $(".gate__hold-progress");
  const soundBtn = $(".sound-btn");
  const nodes = $$(".node");
  const panel = $("#panel");
  const panelClose = $(".panel__close");
  const decodedCount = $("#decoded-count");
  const integrityFill = $("#integrity-fill");
  const integrityPct = $("#integrity-pct");
  const titleFlash = $("#title-flash");
  const holdIndicator = $("#hold-indicator");
  const holdIndicatorFill = $(".hold-indicator__fill");
  const holdIndicatorLabel = $(".hold-indicator__label");
  const revisitBtn = $("#revisit-btn");
  const finaleCta = $(".finale__cta-block");
  const panelFragment = $("#panel-fragment");
  const panelUnlock = $("#panel-unlock");
  const panelUnlockFill = $("#panel-unlock-fill");
  const panelUnlockLabel = $("#panel-unlock-label");
  const panelFallback = $("#panel-fallback");
  const panelFallbackLink = $("#panel-fallback-link");
  const finaleEl = $("#finale");

  /* ═══════════════════════════════════════════════════════════
     NATIVE AUDIO ENGINE — single shared <audio> element
     ═══════════════════════════════════════════════════════════ */

  const audioEl = new Audio();
  audioEl.preload = "none";
  let audioFadeInterval = null;
  let audioStopTimer = null;
  let audioUnlocked = false;

  // Unlock audio on first user interaction — iOS requires this
  function unlockAudioEl() {
    if (audioUnlocked) return;
    audioEl.volume = 0;
    audioEl.muted = true;
    const p = audioEl.play();
    if (p && p.then) {
      p.then(() => {
        audioEl.pause();
        audioEl.muted = false;
        audioEl.currentTime = 0;
        audioUnlocked = true;
        log("audio element unlocked");
      }).catch(() => {
        audioEl.muted = false;
        audioUnlocked = true; // still mark unlocked — the gesture was registered
        log("audio unlock (gesture registered)");
      });
    } else {
      audioUnlocked = true;
    }
  }

  // Global first-interaction unlock
  document.addEventListener("pointerdown", function firstTouch() {
    unlockAudioEl();
    initAudio(); // also unlock Web Audio for UI sounds
    if (actx && actx.state === "suspended") actx.resume();
    document.removeEventListener("pointerdown", firstTouch, true);
  }, { capture: true });

  /**
   * Preload a track's audio (set src, don't play).
   */
  function preloadTrack(trackId) {
    const t = TRACKS[trackId];
    if (!t) return;
    // Only change src if different
    if (audioEl.dataset.track !== String(trackId)) {
      audioEl.src = t.audio.src;
      audioEl.dataset.track = String(trackId);
      audioEl.preload = "auto";
      log("preloading track", trackId, t.title);
    }
  }

  /**
   * Play a track preview. Must be called in user interaction context.
   * Sets src if needed, seeks to start, plays, fades in, schedules stop.
   */
  function playTrack(trackId) {
    if (!state.soundOn) return;

    const t = TRACKS[trackId];
    if (!t) return;

    // Stop any current playback
    stopTrack();

    log("playTrack:", trackId, t.title, "from", t.audio.start, "to", t.audio.end);
    state.activeTrack = trackId;
    duckDrone();

    // Set source if needed
    if (audioEl.dataset.track !== String(trackId)) {
      audioEl.src = t.audio.src;
      audioEl.dataset.track = String(trackId);
    }

    // Seek to start and play at volume 0
    audioEl.currentTime = t.audio.start;
    audioEl.volume = 0;
    log("currentTime set to", t.audio.start);

    const playPromise = audioEl.play();
    if (playPromise && playPromise.then) {
      playPromise.then(() => {
        log("play() succeeded: track", trackId);
      }).catch((e) => {
        log("play() failed: track", trackId, e.message);
        showFallback(trackId);
      });
    }
    log("play() called: track", trackId);

    // Fade in over 400ms
    clearInterval(audioFadeInterval);
    let vol = 0;
    log("fade-in started: track", trackId);
    audioFadeInterval = setInterval(() => {
      vol = Math.min(vol + 0.05, 1);
      audioEl.volume = vol;
      if (vol >= 1) {
        clearInterval(audioFadeInterval);
        audioFadeInterval = null;
        log("fade-in complete: track", trackId);
      }
    }, 20); // 0.05 * 20 steps = 1.0 over 400ms

    // Schedule fade-out before end
    const duration = t.audio.end - t.audio.start;
    const fadeOutAt = Math.max((duration - 0.8) * 1000, 0);

    clearTimeout(audioStopTimer);
    audioStopTimer = setTimeout(() => {
      log("stop timer fired: track", trackId);
      fadeOutTrack();
    }, fadeOutAt);
  }

  /**
   * Fade out and pause.
   */
  function fadeOutTrack() {
    clearInterval(audioFadeInterval);
    clearTimeout(audioStopTimer);

    if (audioEl.paused) return;

    log("fade-out started");
    let vol = audioEl.volume;
    audioFadeInterval = setInterval(() => {
      vol = Math.max(vol - 0.05, 0);
      audioEl.volume = vol;
      if (vol <= 0) {
        clearInterval(audioFadeInterval);
        audioFadeInterval = null;
        audioEl.pause();
        state.activeTrack = null;
        log("fade-out complete, paused");
        unduckDrone();
      }
    }, 20);
  }

  /**
   * Immediately stop playback.
   */
  function stopTrack() {
    clearInterval(audioFadeInterval);
    audioFadeInterval = null;
    clearTimeout(audioStopTimer);
    audioStopTimer = null;

    if (!audioEl.paused) {
      audioEl.volume = 0;
      audioEl.pause();
      log("stopped track:", state.activeTrack);
    }
    state.activeTrack = null;
    unduckDrone();
  }

  /* ═══════════════════════════════════════════════════════════
     WEB AUDIO — UI feedback sounds (ticks + completion chord)
     ═══════════════════════════════════════════════════════════ */
  let actx = null;

  function initAudio() {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      actx = null;
    }
  }

  function playCompletionSound() {
    if (!actx || !state.soundOn) return;
    try {
      [262, 330, 392, 523].forEach((freq, i) => {
        const osc = actx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, actx.currentTime);
        const g = actx.createGain();
        g.gain.setValueAtTime(0, actx.currentTime);
        g.gain.linearRampToValueAtTime(0.08, actx.currentTime + 0.1 + i * 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 3);
        osc.connect(g);
        g.connect(actx.destination);
        osc.start(actx.currentTime + i * 0.15);
        osc.stop(actx.currentTime + 3.5);
      });
    } catch (e) { /* ignore */ }
  }

  function playHoldTick() {
    if (!actx || !state.soundOn) return;
    try {
      const osc = actx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, actx.currentTime);
      const g = actx.createGain();
      g.gain.setValueAtTime(0.03, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.15);
      osc.connect(g);
      g.connect(actx.destination);
      osc.start();
      osc.stop(actx.currentTime + 0.2);
    } catch (e) { /* ignore */ }
  }

  /* ═══════════════════════════════════════════════════════════
     SIGNAL FX ENGINE — procedural glitch/noise via Web Audio
     ═══════════════════════════════════════════════════════════ */
  let noiseBuffer = null;

  function createNoiseBuffer() {
    if (!actx || noiseBuffer) return;
    const len = actx.sampleRate * 2;
    noiseBuffer = actx.createBuffer(1, len, actx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  function makeDistortionCurve(amount) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  function playGlitchBurst(intensity, duration) {
    if (!actx || !state.soundOn) return;
    createNoiseBuffer();
    if (!noiseBuffer) return;
    try {
      const src = actx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = actx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(800 + intensity * 2000, actx.currentTime);
      filter.Q.setValueAtTime(1 + intensity * 3, actx.currentTime);
      const dist = actx.createWaveShaper();
      dist.curve = makeDistortionCurve(intensity * 40);
      const gain = actx.createGain();
      const vol = Math.min(intensity * 0.12, 0.15);
      gain.gain.setValueAtTime(vol, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + duration);
      src.connect(filter);
      filter.connect(dist);
      dist.connect(gain);
      gain.connect(actx.destination);
      src.start();
      src.stop(actx.currentTime + duration);
    } catch (e) { /* ignore */ }
  }

  function playSignalCollapse() {
    if (!actx || !state.soundOn) return;
    createNoiseBuffer();
    if (!noiseBuffer) return;
    try {
      const src = actx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = actx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(4000, actx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(80, actx.currentTime + 0.6);
      const gain = actx.createGain();
      gain.gain.setValueAtTime(0.1, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.7);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(actx.destination);
      src.start();
      src.stop(actx.currentTime + 0.8);
    } catch (e) { /* ignore */ }
  }

  // Sustained noise during hold — starts harsh, cleans up with progress
  let holdNoiseSrc = null;
  let holdNoiseGain = null;
  let holdNoiseFilter = null;

  function startHoldNoise() {
    if (!actx || !state.soundOn) return;
    createNoiseBuffer();
    if (!noiseBuffer) return;
    try {
      holdNoiseSrc = actx.createBufferSource();
      holdNoiseSrc.buffer = noiseBuffer;
      holdNoiseSrc.loop = true;
      holdNoiseFilter = actx.createBiquadFilter();
      holdNoiseFilter.type = "lowpass";
      holdNoiseFilter.frequency.setValueAtTime(3000, actx.currentTime);
      holdNoiseGain = actx.createGain();
      holdNoiseGain.gain.setValueAtTime(0.04, actx.currentTime);
      holdNoiseSrc.connect(holdNoiseFilter);
      holdNoiseFilter.connect(holdNoiseGain);
      holdNoiseGain.connect(actx.destination);
      holdNoiseSrc.start();
    } catch (e) { /* ignore */ }
  }

  function updateHoldNoise(progress) {
    if (!holdNoiseFilter || !holdNoiseGain) return;
    try {
      // As progress increases, filter cleans up (frequency drops) and volume drops
      const freq = 3000 - progress * 2600; // 3000 → 400
      const vol = 0.04 - progress * 0.035; // 0.04 → 0.005
      holdNoiseFilter.frequency.setValueAtTime(Math.max(freq, 100), actx.currentTime);
      holdNoiseGain.gain.setValueAtTime(Math.max(vol, 0.002), actx.currentTime);
    } catch (e) { /* ignore */ }
  }

  function stopHoldNoise() {
    try {
      if (holdNoiseSrc) { holdNoiseSrc.stop(); holdNoiseSrc = null; }
      holdNoiseGain = null;
      holdNoiseFilter = null;
    } catch (e) { /* ignore */ }
  }

  /* ═══════════════════════════════════════════════════════════
     AMBIENT DRONE — sub-bass texture on sigmap when no track plays
     ═══════════════════════════════════════════════════════════ */
  let droneOsc = null;
  let droneNoise = null;
  let droneGain = null;
  let droneActive = false;
  const DRONE_VOL = 0.045;

  function startDrone() {
    if (droneActive || !actx || !state.soundOn) return;
    createNoiseBuffer();
    try {
      droneGain = actx.createGain();
      droneGain.gain.setValueAtTime(0, actx.currentTime);
      droneGain.gain.linearRampToValueAtTime(DRONE_VOL, actx.currentTime + 1.5);
      droneGain.connect(actx.destination);

      // Sub-bass oscillator — slow LFO modulated
      droneOsc = actx.createOscillator();
      droneOsc.type = "sine";
      droneOsc.frequency.setValueAtTime(42, actx.currentTime);
      const lfo = actx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.15, actx.currentTime);
      const lfoGain = actx.createGain();
      lfoGain.gain.setValueAtTime(6, actx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(droneOsc.frequency);
      lfo.start();
      droneOsc._lfo = lfo;

      const oscGain = actx.createGain();
      oscGain.gain.setValueAtTime(0.7, actx.currentTime);
      droneOsc.connect(oscGain);
      oscGain.connect(droneGain);
      droneOsc.start();

      // Filtered noise layer — dark texture
      if (noiseBuffer) {
        droneNoise = actx.createBufferSource();
        droneNoise.buffer = noiseBuffer;
        droneNoise.loop = true;
        const noiseFilter = actx.createBiquadFilter();
        noiseFilter.type = "lowpass";
        noiseFilter.frequency.setValueAtTime(120, actx.currentTime);
        noiseFilter.Q.setValueAtTime(1, actx.currentTime);
        const noiseGain = actx.createGain();
        noiseGain.gain.setValueAtTime(0.3, actx.currentTime);
        droneNoise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(droneGain);
        droneNoise.start();
      }

      droneActive = true;
    } catch (e) { /* ignore */ }
  }

  function stopDrone() {
    if (!droneActive) return;
    try {
      if (droneGain) {
        droneGain.gain.linearRampToValueAtTime(0, actx.currentTime + 0.8);
      }
      setTimeout(() => {
        try {
          if (droneOsc) { droneOsc.stop(); if (droneOsc._lfo) droneOsc._lfo.stop(); droneOsc = null; }
          if (droneNoise) { droneNoise.stop(); droneNoise = null; }
          droneGain = null;
        } catch (e) {}
      }, 900);
    } catch (e) {}
    droneActive = false;
  }

  function duckDrone() {
    if (!droneActive || !droneGain) return;
    try { droneGain.gain.linearRampToValueAtTime(0, actx.currentTime + 0.4); } catch (e) {}
  }

  function unduckDrone() {
    if (!droneActive || !droneGain) return;
    try { droneGain.gain.linearRampToValueAtTime(DRONE_VOL, actx.currentTime + 0.8); } catch (e) {}
  }

  /* ═══════════════════════════════════════════════════════════
     TACTILE FEEDBACK — cross-platform feel layer
     Audio pulses + visual micro-jitter on all browsers.
     Native vibration where available (feature-detected, silent no-op otherwise).
     ═══════════════════════════════════════════════════════════ */
  const canVibrate = typeof navigator.vibrate === "function";
  const atmosEl = $(".atmos");
  let tactileIdx = -1;

  const tactile = {
    /* Subtle resistance pulse — sub-bass thump + micro-jitter + optional vibrate */
    pulse(intensity) {
      if (canVibrate) try { navigator.vibrate(Math.round(intensity * 20)); } catch (e) {}
      this._thump(intensity);
      this._jitter(intensity);
    },

    /* Crisp lock — sharp audiovisual "click into place" */
    lock() {
      if (canVibrate) try { navigator.vibrate([15, 40, 25]); } catch (e) {}
      this._click();
      this._flash("lock");
    },

    /* Rough breakup — stuttered noise + visual shake */
    fail() {
      if (canVibrate) try { navigator.vibrate([5, 25, 5, 25, 5]); } catch (e) {}
      this._stutter();
      this._flash("fail");
    },

    /* Per-frame during hold — escalating resistance via pulse rate + intensity */
    resist(progress) {
      // 8 thresholds, packed denser near lock for urgency
      const thresholds = [0.15, 0.30, 0.45, 0.60, 0.72, 0.82, 0.90, 0.95];
      for (let i = 0; i < thresholds.length; i++) {
        if (progress >= thresholds[i] && tactileIdx < i) {
          tactileIdx = i;
          this.pulse(0.3 + i * 0.1);
        }
      }
    },

    reset() { tactileIdx = -1; },

    /* ── Internal: audio ──────────────────────────── */
    _thump(intensity) {
      if (!actx || !state.soundOn) return;
      try {
        const osc = actx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(35 + intensity * 35, actx.currentTime);
        const g = actx.createGain();
        g.gain.setValueAtTime(0.015 + intensity * 0.04, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.06 + intensity * 0.04);
        osc.connect(g);
        g.connect(actx.destination);
        osc.start();
        osc.stop(actx.currentTime + 0.12);
      } catch (e) {}
    },

    _click() {
      if (!actx || !state.soundOn) return;
      try {
        // Sharp transient
        const osc = actx.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(1200, actx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, actx.currentTime + 0.04);
        const g = actx.createGain();
        g.gain.setValueAtTime(0.06, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.06);
        osc.connect(g);
        g.connect(actx.destination);
        osc.start();
        osc.stop(actx.currentTime + 0.08);
        // Sub-bass follow-through
        const sub = actx.createOscillator();
        sub.type = "sine";
        sub.frequency.setValueAtTime(50, actx.currentTime);
        const sg = actx.createGain();
        sg.gain.setValueAtTime(0.05, actx.currentTime + 0.02);
        sg.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.12);
        sub.connect(sg);
        sg.connect(actx.destination);
        sub.start(actx.currentTime + 0.02);
        sub.stop(actx.currentTime + 0.15);
      } catch (e) {}
    },

    _stutter() {
      if (!actx || !state.soundOn) return;
      createNoiseBuffer();
      if (!noiseBuffer) return;
      try {
        for (let i = 0; i < 4; i++) {
          const t = actx.currentTime + i * 0.06;
          const src = actx.createBufferSource();
          src.buffer = noiseBuffer;
          const filter = actx.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(600 + i * 400, t);
          filter.Q.setValueAtTime(2, t);
          const g = actx.createGain();
          g.gain.setValueAtTime(0.06, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
          src.connect(filter);
          filter.connect(g);
          g.connect(actx.destination);
          src.start(t);
          src.stop(t + 0.05);
        }
      } catch (e) {}
    },

    /* ── Internal: visual ─────────────────────────── */
    _jitter(intensity) {
      if (!atmosEl) return;
      const px = (Math.random() - 0.5) * intensity * 3;
      atmosEl.style.transform = "translate(" + px.toFixed(1) + "px, 0)";
      setTimeout(() => { atmosEl.style.transform = ""; }, 60);
    },

    _flash(type) {
      if (!atmosEl) return;
      atmosEl.classList.add("is-tactile-" + type);
      const dur = type === "lock" ? 150 : 250;
      setTimeout(() => { atmosEl.classList.remove("is-tactile-" + type); }, dur);
    },
  };

  /* ── State Machine ──────────────────────────────────────── */
  function setState(name) {
    state.currentState = name;
    html.dataset.state = name;

    if (name === "sigmap" || name === "finale") {
      soundBtn.classList.add("is-visible");
    }
    if (name === "sigmap") {
      showTitleFlash();
      playGlitchBurst(0.8, 0.3);
      startDrone();
    }
    if (name === "finale") {
      stopDrone();
      stopTrack();
      playSignalCollapse();
      startFinaleSequence();
    }
  }

  /* ── Title Flash ────────────────────────────────────────── */
  function showTitleFlash() {
    if (!titleFlash) return;
    titleFlash.classList.add("is-showing");
    setTimeout(() => {
      titleFlash.classList.remove("is-showing");
      titleFlash.classList.add("is-fading");
    }, 1800);
    setTimeout(() => {
      titleFlash.classList.remove("is-fading");
    }, 4000);
  }

  /* ── Finale Sequence — phased reveal ──────────────────── */
  function startFinaleSequence() {
    const lost = $("#finale-lost");
    const detected = $("#finale-detected");
    const holdPrompt = $("#finale-hold-prompt");

    state.finaleReady = false;
    state.finaleStabilised = false;

    // Phase 1: "signal lost" fades in
    setTimeout(() => {
      if (lost) lost.classList.add("is-visible");
    }, 800);

    // Phase 1→2: fade out "signal lost"
    setTimeout(() => {
      if (lost) lost.classList.remove("is-visible");
    }, 3200);

    // Phase 2: "residual frequency detected" fades in
    setTimeout(() => {
      if (detected) detected.classList.add("is-visible");
    }, 4200);

    // Phase 2→3: fade out "detected"
    setTimeout(() => {
      if (detected) detected.classList.remove("is-visible");
    }, 6500);

    // Phase 3: "Hold to stabilise" — clear and legible
    setTimeout(() => {
      if (holdPrompt) holdPrompt.classList.add("is-visible");
      state.finaleReady = true;
      log("finale ready for hold interaction");
    }, 7500);
  }

  /* ── Gate Boot ──────────────────────────────────────────── */
  function runBoot() {
    gateLines.forEach((line) => {
      const d = parseInt(line.dataset.delay, 10) || 0;
      const hasGlitch = line.hasAttribute("data-glitch");

      if (hasGlitch) {
        // Glitch: briefly show corrupted, then settle into typed
        setTimeout(() => {
          line.classList.add("is-glitching");
          setTimeout(() => {
            line.classList.remove("is-glitching");
            line.classList.add("is-typed");
          }, 180);
        }, d);
      } else {
        setTimeout(() => line.classList.add("is-typed"), d);
      }
    });
    const last = Math.max(
      ...gateLines.map((l) => parseInt(l.dataset.delay, 10) || 0)
    );
    setTimeout(() => gateControls.classList.add("is-revealed"), last + 700);
  }

  /* ── Gate Sound Toggle ────────────────────────────────────── */
  const gateSoundToggle = $("#gate-sound-toggle");
  if (gateSoundToggle) {
    gateSoundToggle.addEventListener("click", () => {
      // Always init audio on any tap — user gesture context
      unlockAudioEl();
      initAudio();
      if (actx && actx.state === "suspended") actx.resume();

      state.soundOn = !state.soundOn;
      gateSoundToggle.dataset.on = String(state.soundOn);
      gateSoundToggle.dataset.tapped = "true";
      const label = $(".gate__sound-label", gateSoundToggle);
      if (label) label.textContent = state.soundOn ? "Sound on" : "Sound off";
    });
  }

  /* ═══════════════════════════════════════════════════════════
     HOLD ENGINE — used by gate, panel unlock, and finale
     ═══════════════════════════════════════════════════════════ */
  const GATE_HOLD_TIME = 1500;
  const UNLOCK_HOLD_TIME = 600;
  const FINALE_HOLD_TIME = 2000;

  let holdStart = 0;
  let holdRaf = null;
  let holdContext = null;

  function setHolding(isHolding) {
    state.holding = isHolding;
    html.dataset.holding = String(isHolding);
    if (state.currentState === "finale") {
      finaleEl.dataset.holding = String(isHolding);
    }
  }

  function startHold(context) {
    if (holdRaf) return;
    holdContext = context;
    holdStart = performance.now();
    setHolding(true);
    playHoldTick();
    tactile.reset();
    tactile.pulse(0.3);
    startHoldNoise();

    if (context === "gate" && gateHoldZone) {
      gateHoldZone.classList.add("is-holding");
    }
    if (context === "unlock" && panelUnlock) {
      panelUnlock.classList.add("is-holding");
    }
    if (context === "finale") {
      holdIndicator.classList.add("is-visible");
      holdIndicatorLabel.textContent = "Hold to stabilise";
    }

    holdRaf = requestAnimationFrame(updateHoldProgress);
  }

  function updateHoldProgress() {
    const elapsed = performance.now() - holdStart;
    let duration;
    if (holdContext === "gate") duration = GATE_HOLD_TIME;
    else if (holdContext === "unlock") duration = UNLOCK_HOLD_TIME;
    else duration = FINALE_HOLD_TIME;

    const progress = Math.min(elapsed / duration, 1);

    // Update hold noise — cleans up as progress increases
    updateHoldNoise(progress);

    // Tactile resistance — escalating pulses, denser near lock
    tactile.resist(progress);

    if (holdContext === "gate" && gateProgress) {
      gateProgress.style.width = progress * 100 + "%";
    }
    if (holdContext === "unlock" && panelUnlockFill) {
      panelUnlockFill.style.width = progress * 100 + "%";
    }
    if (holdContext === "finale" && holdIndicatorFill) {
      holdIndicatorFill.style.strokeDashoffset = String(169.65 * (1 - progress));
    }

    if (progress >= 1) {
      completeHold();
      return;
    }
    holdRaf = requestAnimationFrame(updateHoldProgress);
  }

  function completeHold() {
    if (holdRaf) cancelAnimationFrame(holdRaf);
    holdRaf = null;
    stopHoldNoise();
    tactile.lock();

    /* ── Gate ─────────────────────────────────────────── */
    if (holdContext === "gate") {
      soundBtn.setAttribute("data-active", String(state.soundOn));
      setState("sigmap");
      resetHoldVisuals();
    }

    /* ── Panel unlock — decode fragment + play audio ──── */
    else if (holdContext === "unlock") {
      const trackId = state.panelTrackId;
      log("unlock complete for track", trackId);

      // Mark decoded
      if (trackId && !state.explored.has(trackId)) {
        state.explored.add(trackId);
        const nodeEl = $(`.node[data-track="${trackId}"]`);
        if (nodeEl) nodeEl.classList.add("is-decoded");

        const count = state.explored.size;
        decodedCount.textContent = String(count);
        html.dataset.explored = String(count);
        updateIntegrity(count);
      }

      // Stabilise fragment
      if (panelFragment) {
        panelFragment.classList.remove("corrupted");
        panelFragment.classList.add("is-stable");
      }
      if (panelUnlock) {
        panelUnlock.classList.remove("is-holding");
        panelUnlock.classList.add("is-unlocked");
      }
      if (panelUnlockLabel) {
        panelUnlockLabel.textContent = "Signal Unlocked";
      }

      // Play audio
      if (trackId) {
        log("unlock triggered playback for track", trackId);
        playTrack(trackId);
      }

      resetHoldVisuals();
    }

    /* ── Finale ──────────────────────────────────────── */
    else if (holdContext === "finale") {
      if (!state.finaleStabilised) {
        state.finaleStabilised = true;

        // Hide hold prompt, reveal "WE REMAIN"
        const holdPrompt = $("#finale-hold-prompt");
        const reveal = $("#finale-reveal");

        if (holdPrompt) holdPrompt.classList.remove("is-visible");
        setTimeout(() => {
          if (reveal) reveal.classList.add("is-visible");
        }, 400);

        // After a pause, show clean CTA
        setTimeout(() => {
          if (finaleCta) finaleCta.classList.add("is-revealed");
        }, 2000);
      }
      resetHoldVisuals();
    }

    holdContext = null;
  }

  function cancelHold() {
    if (holdRaf) cancelAnimationFrame(holdRaf);
    holdRaf = null;
    stopHoldNoise();
    tactile.fail();
    setHolding(false);
    resetHoldVisuals();
    holdContext = null;
  }

  function resetHoldVisuals() {
    if (gateProgress) gateProgress.style.width = "0%";
    if (gateHoldZone) gateHoldZone.classList.remove("is-holding");

    if (panelUnlock && !panelUnlock.classList.contains("is-unlocked")) {
      panelUnlock.classList.remove("is-holding");
      if (panelUnlockFill) panelUnlockFill.style.width = "0%";
    }

    holdIndicator.classList.remove("is-visible");
    if (holdIndicatorFill) holdIndicatorFill.style.strokeDashoffset = "169.65";

    setHolding(false);
  }

  /* ── Gate Hold Zone ─────────────────────────────────────── */
  if (gateHoldZone) {
    gateHoldZone.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      // Init audio in user gesture context — critical for iOS
      if (state.soundOn) {
        unlockAudioEl();
        initAudio();
        if (actx && actx.state === "suspended") actx.resume();
      }
      startHold("gate");
    });
    gateHoldZone.addEventListener("pointerup", () => {
      if (holdContext === "gate") cancelHold();
    });
    gateHoldZone.addEventListener("pointercancel", () => {
      if (holdContext === "gate") cancelHold();
    });
    gateHoldZone.addEventListener("pointerleave", () => {
      if (holdContext === "gate") cancelHold();
    });
    gateHoldZone.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* ═══════════════════════════════════════════════════════════
     NODES — simple TAP to open panel (no hold)
     ═══════════════════════════════════════════════════════════ */
  nodes.forEach((node) => {
    node.addEventListener("click", () => {
      const trackId = parseInt(node.dataset.track, 10);
      openPanel(trackId);
    });
  });

  /* ═══════════════════════════════════════════════════════════
     PANEL — info display + hold-to-unlock button
     ═══════════════════════════════════════════════════════════ */
  function openPanel(trackId) {
    const t = TRACKS[trackId];
    if (!t) return;

    // Stop any playing preview when opening a new panel
    stopTrack();

    state.panelTrackId = trackId;

    panel.style.setProperty(
      "--phase-color",
      "var(--" + (t.color === "ghost" ? "ghost-c" : t.color) + ")"
    );
    panel.style.setProperty(
      "--phase-glow",
      "var(--" + (t.color === "ghost" ? "ghost-c" : t.color) + ")"
    );

    $("#panel-number").textContent = t.number;
    $("#panel-phase").textContent = t.phase;
    $("#panel-pct").textContent = t.pct;
    $("#panel-title").textContent = t.title;
    $("#panel-status").textContent = t.status;
    $("#panel-body").textContent = t.body;
    $("#panel-fragment").textContent = t.fragment;

    renderBars($("#panel-bars"), t.signal, t.color);

    const isDecoded = state.explored.has(trackId);

    if (panelFragment) {
      if (isDecoded) {
        panelFragment.classList.remove("corrupted");
        panelFragment.classList.add("is-stable");
      } else {
        panelFragment.classList.add("corrupted");
        panelFragment.classList.remove("is-stable");
      }
    }

    if (panelUnlock) {
      panelUnlock.classList.remove("is-holding");
      if (isDecoded) {
        panelUnlock.classList.add("is-unlocked");
      } else {
        panelUnlock.classList.remove("is-unlocked");
      }
    }
    if (panelUnlockFill) {
      panelUnlockFill.style.width = isDecoded ? "100%" : "0%";
    }
    if (panelUnlockLabel) {
      panelUnlockLabel.textContent = isDecoded
        ? "Signal Unlocked"
        : "Hold to Unlock Signal";
    }

    // Hide fallback by default
    hideFallback();

    // Preload audio for this track (lazy — only when panel opens)
    preloadTrack(trackId);

    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    state.panelOpen = true;
    playGlitchBurst(0.3, 0.15); // light glitch on panel open
  }

  // Swipe state — declared here so closePanel can reset them
  let swipeStartY = 0;
  let swipeDelta = 0;
  let swipeActive = false;
  let swipeTracking = false;

  function closePanel() {
    const allDecoded = state.explored.size === 6;
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    state.panelOpen = false;
    state.panelTrackId = null;
    if (holdContext === "unlock") cancelHold();
    // Reset any in-progress swipe state
    swipeTracking = false;
    swipeActive = false;

    // All 6 decoded — enter finale when panel closes
    if (allDecoded && state.currentState !== "finale") {
      fadeOutTrack();
      setTimeout(() => {
        playCompletionSound();
        setState("finale");
      }, 600);
    }
  }

  panelClose.addEventListener("click", closePanel);
  $(".panel__backdrop").addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.panelOpen) closePanel();
  });

  /* ═══════════════════════════════════════════════════════════
     SWIPE TO CLOSE — bidirectional gesture to dismiss panel
     Up = harsh disconnect, Down = controlled exit
     ═══════════════════════════════════════════════════════════ */
  const panelShell = $(".panel__shell");
  const panelBackdrop = $(".panel__backdrop");
  const SWIPE_THRESHOLD = 80;
  const SWIPE_ACTIVATE = 12;
  let swipeDirection = null; // "up" or "down"

  panel.addEventListener("touchstart", (e) => {
    if (!state.panelOpen) return;
    if (e.target.closest("#panel-unlock")) return;
    if (holdContext === "unlock") return;

    swipeStartY = e.touches[0].clientY;
    swipeTracking = true;
    swipeActive = false;
    swipeDelta = 0;
    swipeDirection = null;
  }, { passive: true });

  panel.addEventListener("touchmove", (e) => {
    if (!swipeTracking) return;

    const currentY = e.touches[0].clientY;
    const rawDelta = swipeStartY - currentY; // positive = finger moving up

    // Determine direction on first significant movement
    if (!swipeDirection && Math.abs(rawDelta) > SWIPE_ACTIVATE) {
      if (rawDelta > 0 && panelShell.scrollTop <= 0) {
        swipeDirection = "up";
      } else if (rawDelta < 0) {
        // Allow swipe down only if at scroll bottom or content not scrollable
        const atBottom = panelShell.scrollHeight - panelShell.scrollTop - panelShell.clientHeight < 2;
        if (atBottom) {
          swipeDirection = "down";
        } else {
          swipeTracking = false;
          return;
        }
      } else {
        swipeTracking = false;
        return;
      }
    }

    if (!swipeDirection) return;

    const absDelta = Math.abs(rawDelta);
    if (absDelta > SWIPE_ACTIVATE) {
      if (!swipeActive) {
        swipeActive = true;
        panelShell.style.transition = "none";
        panelShell.style.willChange = "transform, opacity";
        panelBackdrop.style.transition = "none";
      }
      e.preventDefault();

      swipeDelta = absDelta;
      const translateY = Math.min(absDelta * 0.6, 220);
      const scale = Math.max(1 - absDelta * 0.0004, 0.93);
      const shellOpacity = Math.max(1 - absDelta / 400, 0.4);
      const backdropOpacity = Math.max(1 - absDelta / 250, 0.2);

      const direction = swipeDirection === "up" ? -1 : 1;
      panelShell.style.transform =
        "translateY(" + (direction * translateY) + "px) scale(" + scale + ")";
      panelShell.style.opacity = String(shellOpacity);
      panelBackdrop.style.opacity = String(backdropOpacity);
    }
  }, { passive: false });

  panel.addEventListener("touchend", handleSwipeEnd);
  panel.addEventListener("touchcancel", handleSwipeEnd);

  function handleSwipeEnd() {
    if (!swipeActive) {
      swipeTracking = false;
      swipeDirection = null;
      return;
    }

    if (swipeDelta >= SWIPE_THRESHOLD) {
      const dir = swipeDirection;
      const exitY = dir === "up" ? "-120%" : "120%";

      // Swipe up = harsh disconnect FX
      if (dir === "up") {
        playSignalCollapse();
        tactile.fail();
      } else {
        // Swipe down = controlled exit
        tactile.pulse(0.4);
      }

      panelShell.style.transition =
        "transform 0.22s ease-out, opacity 0.22s ease-out";
      panelShell.style.transform = "translateY(" + exitY + ") scale(0.92)";
      panelShell.style.opacity = "0";
      panelBackdrop.style.transition = "opacity 0.22s ease-out";
      panelBackdrop.style.opacity = "0";

      setTimeout(() => {
        closePanel();
        clearSwipeStyles();
      }, 230);
    } else {
      // Snap back
      panelShell.style.transition =
        "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease";
      panelShell.style.transform = "";
      panelShell.style.opacity = "";
      panelBackdrop.style.transition = "opacity 0.3s ease";
      panelBackdrop.style.opacity = "";

      setTimeout(clearSwipeStyles, 350);
    }

    swipeTracking = false;
    swipeActive = false;
    swipeDelta = 0;
    swipeDirection = null;
  }

  function clearSwipeStyles() {
    if (!panelShell || !panelBackdrop) return;
    panelShell.style.transition = "";
    panelShell.style.transform = "";
    panelShell.style.opacity = "";
    panelShell.style.willChange = "";
    panelBackdrop.style.transition = "";
    panelBackdrop.style.opacity = "";
  }

  /* ── Panel Unlock Button — hold interaction ─────────────── */
  if (panelUnlock) {
    panelUnlock.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (panelUnlock.classList.contains("is-unlocked")) return;

      // Ensure audio is unlocked in this user gesture
      unlockAudioEl();
      if (state.soundOn) {
        initAudio();
        if (actx && actx.state === "suspended") actx.resume();
      }

      // Pre-set src and seek NOW in user gesture context so play() works later
      if (state.soundOn && state.panelTrackId) {
        const t = TRACKS[state.panelTrackId];
        if (t) {
          if (audioEl.dataset.track !== String(state.panelTrackId)) {
            audioEl.src = t.audio.src;
            audioEl.dataset.track = String(state.panelTrackId);
          }
          audioEl.currentTime = t.audio.start;
          audioEl.volume = 0;
          // Start playing muted immediately — in user gesture context
          audioEl.play().catch(() => {});
          log("early play() in user gesture: track", state.panelTrackId);
        }
      }

      startHold("unlock");
    });
    panelUnlock.addEventListener("pointerup", () => {
      if (holdContext === "unlock") {
        // If hold wasn't completed, pause the early-started audio
        if (!panelUnlock.classList.contains("is-unlocked")) {
          audioEl.pause();
          audioEl.volume = 0;
        }
        cancelHold();
      }
    });
    panelUnlock.addEventListener("pointercancel", () => {
      if (holdContext === "unlock") {
        audioEl.pause();
        audioEl.volume = 0;
        cancelHold();
      }
    });
    panelUnlock.addEventListener("pointerleave", () => {
      if (holdContext === "unlock") {
        audioEl.pause();
        audioEl.volume = 0;
        cancelHold();
      }
    });
    panelUnlock.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /**
   * Show fallback link if audio fails.
   */
  function showFallback(trackId) {
    const t = TRACKS[trackId];
    if (!t || !panelFallback || !panelFallbackLink) return;
    // Link to the SoundCloud EP
    panelFallbackLink.href = "https://soundcloud.com/officialulix/sets/dead-frequencies-ep";
    panelFallback.removeAttribute("hidden");
    log("fallback shown for track", trackId);
  }

  function hideFallback() {
    if (panelFallback) panelFallback.setAttribute("hidden", "");
  }

  /* ── Signal bar renderer ────────────────────────────────── */
  function renderBars(container, filled, color) {
    const total = 8;
    const colorVar =
      color === "ghost" ? "var(--ghost-c)" : "var(--" + color + ")";
    let out = "";
    for (let i = 0; i < total; i++) {
      const on = i < filled;
      out +=
        '<span style="display:inline-block;width:3px;height:' +
        (3 + i * 1.1) +
        "px;border-radius:1px;margin-right:1px;background:" +
        (on ? colorVar : "var(--line)") +
        ";opacity:" +
        (on ? 0.7 : 0.25) +
        ';vertical-align:bottom;"></span>';
    }
    container.innerHTML = out;
  }

  /* ── Signal integrity meter ─────────────────────────────── */
  function updateIntegrity(explored) {
    const map = {
      0: { pct: 100, color: "var(--cold)" },
      1: { pct: 78, color: "var(--cold)" },
      2: { pct: 54, color: "var(--warm)" },
      3: { pct: 32, color: "var(--ghost-c)" },
      4: { pct: 8, color: "var(--critical)" },
      5: { pct: 42, color: "var(--ember)" },
      6: { pct: 100, color: "var(--resolve)" },
    };
    const info = map[explored] || map[0];
    if (integrityFill) {
      integrityFill.style.width = info.pct + "%";
      integrityFill.style.backgroundColor = info.color;
    }
    if (integrityPct) integrityPct.textContent = info.pct + "%";
  }

  /* ── Sound Toggle ───────────────────────────────────────── */
  soundBtn.addEventListener("click", () => {
    state.soundOn = !state.soundOn;
    soundBtn.setAttribute("data-active", String(state.soundOn));
    if (!state.soundOn) {
      stopTrack();
      stopDrone();
    } else if (state.currentState === "sigmap" && !state.activeTrack) {
      startDrone();
    }
  });

  /* ── Finale Hold-to-Stabilise ───────────────────────────── */
  finaleEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (state.currentState !== "finale" || state.finaleStabilised) return;
    if (!state.finaleReady) return;
    startHold("finale");
  });
  finaleEl.addEventListener("pointerup", () => {
    if (holdContext === "finale") cancelHold();
  });
  finaleEl.addEventListener("pointercancel", () => {
    if (holdContext === "finale") cancelHold();
  });
  finaleEl.addEventListener("contextmenu", (e) => {
    if (state.currentState === "finale" && !state.finaleStabilised)
      e.preventDefault();
  });

  /* ── Revisit ────────────────────────────────────────────── */
  if (revisitBtn) {
    revisitBtn.addEventListener("click", () => setState("sigmap"));
  }

  /* ── Init ───────────────────────────────────────────────── */
  log("Dead Frequencies engine starting");
  setState("gate");
  runBoot();
})();
