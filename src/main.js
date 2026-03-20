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
    soundOn: true,
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
  const gateSndBtns = $$(".gate__snd");
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

  /* ── State Machine ──────────────────────────────────────── */
  function setState(name) {
    state.currentState = name;
    html.dataset.state = name;

    if (name === "sigmap" || name === "finale") {
      soundBtn.classList.add("is-visible");
    }
    if (name === "sigmap") {
      showTitleFlash();
    }
    if (name === "finale") {
      stopTrack();
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
      setTimeout(() => line.classList.add("is-typed"), d);
    });
    const last = Math.max(
      ...gateLines.map((l) => parseInt(l.dataset.delay, 10) || 0)
    );
    setTimeout(() => gateControls.classList.add("is-revealed"), last + 700);
  }

  /* ── Gate Sound Choice ──────────────────────────────────── */
  gateSndBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      gateSndBtns.forEach((b) => b.classList.remove("gate__snd--active"));
      btn.classList.add("gate__snd--active");
      state.soundOn = btn.dataset.sound === "on";
    });
  });

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

    /* ── Gate ─────────────────────────────────────────── */
    if (holdContext === "gate") {
      if (state.soundOn) {
        initAudio();
        if (actx && actx.state === "suspended") actx.resume();
      }
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

      // Check completion → finale
      // Let audio play fully, fade naturally, then transition gently
      if (state.explored.size === 6) {
        const t = TRACKS[trackId];
        // Audio fade-out is already scheduled by playTrack (0.8s before end)
        // Wait for full preview duration so audio completes naturally
        const previewDuration = t ? (t.audio.end - t.audio.start) * 1000 : 10000;
        // Add breathing room after audio ends
        const afterAudio = previewDuration + 1800;
        log("final track — waiting", afterAudio, "ms for audio to finish naturally");

        setTimeout(() => {
          // Close panel gently
          closePanel();
          // Longer pause — let the emptiness sit
          setTimeout(() => {
            playCompletionSound();
            setState("finale");
          }, 1800);
        }, afterAudio);
      }
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
  }

  // Swipe state — declared here so closePanel can reset them
  let swipeStartY = 0;
  let swipeDelta = 0;
  let swipeActive = false;
  let swipeTracking = false;

  function closePanel() {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    state.panelOpen = false;
    state.panelTrackId = null;
    if (holdContext === "unlock") cancelHold();
    // Reset any in-progress swipe state
    swipeTracking = false;
    swipeActive = false;
  }

  panelClose.addEventListener("click", closePanel);
  $(".panel__backdrop").addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.panelOpen) closePanel();
  });

  /* ═══════════════════════════════════════════════════════════
     SWIPE UP TO CLOSE — fluid gesture to dismiss panel
     ═══════════════════════════════════════════════════════════ */
  const panelShell = $(".panel__shell");
  const panelBackdrop = $(".panel__backdrop");
  const SWIPE_THRESHOLD = 80;
  const SWIPE_ACTIVATE = 12; // min movement before swipe mode engages

  panel.addEventListener("touchstart", (e) => {
    if (!state.panelOpen) return;
    // Don't interfere with unlock button hold
    if (e.target.closest("#panel-unlock")) return;
    // Don't interfere with active hold
    if (holdContext === "unlock") return;

    swipeStartY = e.touches[0].clientY;
    swipeTracking = true;
    swipeActive = false;
    swipeDelta = 0;
  }, { passive: true });

  panel.addEventListener("touchmove", (e) => {
    if (!swipeTracking) return;

    const currentY = e.touches[0].clientY;
    const delta = swipeStartY - currentY; // positive = swiping up

    // Only swipe-to-close when moving up and panel content is at scroll top
    if (delta > 0 && panelShell.scrollTop <= 0) {
      if (delta > SWIPE_ACTIVATE) {
        if (!swipeActive) {
          swipeActive = true;
          panelShell.style.transition = "none";
          panelShell.style.willChange = "transform, opacity";
          panelBackdrop.style.transition = "none";
        }
        e.preventDefault();

        swipeDelta = delta;
        // Dampen: panel follows finger at 60% speed, cap visual shift
        const translateY = Math.min(delta * 0.6, 220);
        const scale = Math.max(1 - delta * 0.0004, 0.93);
        const shellOpacity = Math.max(1 - delta / 400, 0.4);
        const backdropOpacity = Math.max(1 - delta / 250, 0.2);

        panelShell.style.transform =
          "translateY(-" + translateY + "px) scale(" + scale + ")";
        panelShell.style.opacity = String(shellOpacity);
        panelBackdrop.style.opacity = String(backdropOpacity);
      }
    } else if (delta < -8) {
      // Swiping down — not a close gesture, let normal scroll happen
      swipeTracking = false;
    }
  }, { passive: false });

  panel.addEventListener("touchend", handleSwipeEnd);
  panel.addEventListener("touchcancel", handleSwipeEnd);

  function handleSwipeEnd() {
    if (!swipeActive) {
      swipeTracking = false;
      return;
    }

    if (swipeDelta >= SWIPE_THRESHOLD) {
      // Threshold met — animate out upward, then close
      panelShell.style.transition =
        "transform 0.22s ease-out, opacity 0.22s ease-out";
      panelShell.style.transform = "translateY(-120%) scale(0.92)";
      panelShell.style.opacity = "0";
      panelBackdrop.style.transition = "opacity 0.22s ease-out";
      panelBackdrop.style.opacity = "0";

      setTimeout(() => {
        closePanel();
        clearSwipeStyles();
      }, 230);
    } else {
      // Snap back — spring animation to resting position
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
    if (!state.soundOn) stopTrack();
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
