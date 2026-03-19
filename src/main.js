/* ═══════════════════════════════════════════════════════════════
   DEAD FREQUENCIES — Transmission Experience Engine
   State Machine: gate → sigmap → (panel) → finale
   Interaction: TAP node → open panel → HOLD to unlock signal
   ═══════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const DEBUG = true;
  function log(/* ...args */) {
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
      sc: { url: "https://on.soundcloud.com/0M2XafQ1KMWYzMfd08", start: 36000, end: 49000 },
    },
    2: {
      number: "02", title: "Drown Tonight",
      phase: "Phase: Submersion", status: "SIGNAL DEGRADING",
      signal: 4, pct: "54%", color: "warm",
      body: "The collapse turns inward. Noise and pressure overwhelm until breathing through the disconnection feels impossible.",
      fragment: '"sinking past the frequency / where voices used to reach"',
      sc: { url: "https://on.soundcloud.com/47hmR9FlGykzXWbvGp", start: 82000, end: 100000 },
    },
    3: {
      number: "03", title: "Ghost",
      phase: "Phase: Fracture", status: "IDENTITY FRAGMENTED",
      signal: 3, pct: "32%", color: "ghost",
      body: "Still physically present, but mentally absent. Identity fractures until the self becomes a ghost inside its own life.",
      fragment: '"i\'m standing right here / but nothing registers"',
      sc: { url: "https://on.soundcloud.com/79abXnduus7mkZtVx7", start: 11000, end: 21000 },
    },
    4: {
      number: "04", title: "Neon Graves",
      phase: "Phase: Collapse", status: "SIGNAL LOST",
      signal: 1, pct: "08%", color: "critical",
      body: "Total breakdown. Dead lights and lost signals turn the city into a graveyard of everything that once felt stable.",
      fragment: '"every light that burned is now a monument to what we lost"',
      sc: { url: "https://on.soundcloud.com/IB0VhjAPfOwvGjvyyo", start: 90000, end: 113000 },
    },
    5: {
      number: "05", title: "Light The Fire",
      phase: "Phase: Defiance", status: "SIGNAL OVERRIDE",
      signal: 4, pct: "MANUAL", color: "ember",
      body: "A moment of defiance. Instead of waiting for the system to recover, the protagonist breaks free from it.",
      fragment: '"burn the protocol / override the silence"',
      sc: { url: "https://on.soundcloud.com/GTtVUYflIbDxBsJlQ2", start: 36000, end: 49000 },
    },
    6: {
      number: "06", title: "We Remain",
      phase: "Phase: Survival", status: "SIGNAL PERSISTS",
      signal: 8, pct: "HUMAN", color: "resolve",
      body: "Silence settles after the collapse. The world is scarred and broken, but something human survives — and keeps transmitting.",
      fragment: '"after everything / we are still here / still transmitting"',
      sc: { url: "https://on.soundcloud.com/OodRAnjMNr8TgtZeFj", start: 101000, end: 112000 },
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
  const finaleQuote = $(".finale__quote");
  const finalePrompt = $(".finale__signal-prompt");
  const finaleCta = $(".finale__cta-block");
  const panelFragment = $("#panel-fragment");
  const panelUnlock = $("#panel-unlock");
  const panelUnlockFill = $("#panel-unlock-fill");
  const panelUnlockLabel = $("#panel-unlock-label");
  const finaleEl = $("#finale");

  /* ═══════════════════════════════════════════════════════════
     SOUNDCLOUD WIDGET ENGINE
     ═══════════════════════════════════════════════════════════ */
  const scWidgets = {};
  let scInited = false;
  let scFadeInterval = null;
  let scStopTimer = null;

  function initSCWidgets() {
    if (scInited) return;
    scInited = true;

    if (!window.SC || !window.SC.Widget) {
      log("SC Widget API not available — will use fallback audio");
      return;
    }
    log("SC Widget API loaded, creating widgets...");

    const container = $("#sc-players");
    if (!container) return;

    Object.entries(TRACKS).forEach(([id, t]) => {
      const iframe = document.createElement("iframe");
      iframe.id = "sc-" + id;
      iframe.allow = "autoplay";
      iframe.loading = "eager";
      iframe.src =
        "https://w.soundcloud.com/player/?url=" +
        encodeURIComponent(t.sc.url) +
        "&auto_play=false&buying=false&sharing=false&show_artwork=false" +
        "&show_comments=false&show_playcount=false&show_user=false" +
        "&hide_related=true&visual=false&single_active=false";
      container.appendChild(iframe);

      const widget = SC.Widget(iframe);
      scWidgets[id] = { widget, ready: false, fadingOut: false };

      widget.bind(SC.Widget.Events.READY, () => {
        scWidgets[id].ready = true;
        log("SC widget READY: track", id, t.title);
      });

      widget.bind(SC.Widget.Events.ERROR, () => {
        log("SC widget ERROR: track", id);
      });
    });
  }

  /**
   * Play a SC track. Call within user gesture (pointerdown) for mobile.
   * Starts muted, seeks to start, then fades in.
   */
  function playSCTrack(trackId) {
    stopSCTrack();

    const key = String(trackId);
    const w = scWidgets[key];
    if (!w || !w.ready) {
      log("SC widget not ready for track", trackId, "— using fallback");
      playNodeSound(trackId);
      return;
    }
    if (!state.soundOn) return;

    const t = TRACKS[trackId];
    log("Playing SC track", trackId, t.title, "from", t.sc.start, "to", t.sc.end);

    state.activeTrack = trackId;
    w.fadingOut = false;

    // Start muted within user gesture, then seek + fade in
    w.widget.setVolume(0);
    w.widget.seekTo(t.sc.start);
    w.widget.play();

    // Fade in over ~500ms
    let vol = 0;
    clearInterval(scFadeInterval);
    scFadeInterval = setInterval(() => {
      vol = Math.min(vol + 5, 100);
      try { w.widget.setVolume(vol); } catch (e) {}
      if (vol >= 100) {
        clearInterval(scFadeInterval);
        log("SC fade-in complete, track", trackId);
      }
    }, 25);

    // Schedule fade-out before end
    const clipLen = t.sc.end - t.sc.start;
    const maxDuration = 20000; // 20s safety cap
    const playDuration = Math.min(clipLen, maxDuration);
    const fadeOutAt = Math.max(playDuration - 800, 0);

    clearTimeout(scStopTimer);
    scStopTimer = setTimeout(() => {
      log("SC auto-fadeout at end, track", trackId);
      fadeSCOut(trackId);
    }, fadeOutAt);
  }

  function fadeSCOut(trackId) {
    const key = String(trackId);
    const w = scWidgets[key];
    if (!w) return;
    if (w.fadingOut) return;
    w.fadingOut = true;

    clearInterval(scFadeInterval);
    clearTimeout(scStopTimer);

    let vol = 100;
    scFadeInterval = setInterval(() => {
      vol = Math.max(vol - 5, 0);
      try { w.widget.setVolume(vol); } catch (e) {}
      if (vol <= 0) {
        clearInterval(scFadeInterval);
        try { w.widget.pause(); } catch (e) {}
        if (state.activeTrack === trackId) state.activeTrack = null;
        log("SC fade-out complete, track", trackId);
      }
    }, 25);
  }

  function stopSCTrack() {
    clearTimeout(scStopTimer);
    clearInterval(scFadeInterval);
    if (state.activeTrack !== null) {
      const key = String(state.activeTrack);
      const w = scWidgets[key];
      if (w && w.ready) {
        try {
          w.widget.setVolume(0);
          w.widget.pause();
        } catch (e) {}
      }
      state.activeTrack = null;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     WEB AUDIO — UI feedback sounds (fallback + ticks)
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

  function playNodeSound(trackNum) {
    if (!actx || !state.soundOn) return;
    try {
      const freqMap = { 1: 440, 2: 330, 3: 294, 4: 220, 5: 392, 6: 523 };
      const osc = actx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freqMap[trackNum] || 440, actx.currentTime);
      const g = actx.createGain();
      g.gain.setValueAtTime(0, actx.currentTime);
      g.gain.linearRampToValueAtTime(0.12, actx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 1.2);
      osc.connect(g);
      g.connect(actx.destination);
      osc.start();
      osc.stop(actx.currentTime + 1.5);
    } catch (e) {}
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
    } catch (e) {}
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
    } catch (e) {}
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
      initSCWidgets();
    }
    if (name === "finale") {
      stopSCTrack();
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
  let holdContext = null; // "gate" | "unlock" | "finale"

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
      log("Unlock complete for track", trackId);

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

      // Play SC audio (this is within the rAF chain from pointerdown — user gesture)
      if (trackId) playSCTrack(trackId);

      resetHoldVisuals();

      // Check completion → finale
      if (state.explored.size === 6) {
        setTimeout(() => {
          closePanel();
          setTimeout(() => {
            stopSCTrack();
            playCompletionSound();
            setState("finale");
          }, 500);
        }, 2500);
      }
    }

    /* ── Finale ──────────────────────────────────────── */
    else if (holdContext === "finale") {
      if (!state.finaleStabilised) {
        state.finaleStabilised = true;
        if (finaleQuote) {
          finaleQuote.classList.remove("corrupted");
          finaleQuote.classList.add("is-stable");
        }
        if (finalePrompt) finalePrompt.classList.add("is-hidden");
        setTimeout(() => {
          if (finaleCta) finaleCta.classList.add("is-revealed");
        }, 800);
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

    // Reset or set unlock state based on whether track is already decoded
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

    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    state.panelOpen = true;
  }

  function closePanel() {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    state.panelOpen = false;
    state.panelTrackId = null;
    if (holdContext === "unlock") cancelHold();
  }

  panelClose.addEventListener("click", closePanel);
  $(".panel__backdrop").addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.panelOpen) closePanel();
  });

  /* ── Panel Unlock Button — hold interaction ─────────────── */
  if (panelUnlock) {
    panelUnlock.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      // Don't allow re-unlock
      if (panelUnlock.classList.contains("is-unlocked")) return;

      // Init audio context within user gesture
      if (state.soundOn) {
        initAudio();
        if (actx && actx.state === "suspended") actx.resume();
      }

      startHold("unlock");
    });
    panelUnlock.addEventListener("pointerup", () => {
      if (holdContext === "unlock") cancelHold();
    });
    panelUnlock.addEventListener("pointercancel", () => {
      if (holdContext === "unlock") cancelHold();
    });
    panelUnlock.addEventListener("pointerleave", () => {
      if (holdContext === "unlock") cancelHold();
    });
    panelUnlock.addEventListener("contextmenu", (e) => e.preventDefault());
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
    if (!state.soundOn) stopSCTrack();
  });

  /* ── Finale Hold-to-Stabilise ───────────────────────────── */
  finaleEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (state.currentState !== "finale" || state.finaleStabilised) return;
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
