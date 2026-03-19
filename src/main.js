/* ═══════════════════════════════════════════════════════════════
   DEAD FREQUENCIES — Transmission Experience Engine
   State Machine: gate → sigmap → (panel) → finale
   Core Mechanic: HOLD TO STABILISE
   ═══════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

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
    },
    2: {
      number: "02", title: "Drown Tonight",
      phase: "Phase: Submersion", status: "SIGNAL DEGRADING",
      signal: 4, pct: "54%", color: "warm",
      body: "The collapse turns inward. Noise and pressure overwhelm until breathing through the disconnection feels impossible.",
      fragment: '"sinking past the frequency / where voices used to reach"',
    },
    3: {
      number: "03", title: "Ghost",
      phase: "Phase: Fracture", status: "IDENTITY FRAGMENTED",
      signal: 3, pct: "32%", color: "ghost",
      body: "Still physically present, but mentally absent. Identity fractures until the self becomes a ghost inside its own life.",
      fragment: '"i\'m standing right here / but nothing registers"',
    },
    4: {
      number: "04", title: "Neon Graves",
      phase: "Phase: Collapse", status: "SIGNAL LOST",
      signal: 1, pct: "08%", color: "critical",
      body: "Total breakdown. Dead lights and lost signals turn the city into a graveyard of everything that once felt stable.",
      fragment: '"every light that burned is now a monument to what we lost"',
    },
    5: {
      number: "05", title: "Light The Fire",
      phase: "Phase: Defiance", status: "SIGNAL OVERRIDE",
      signal: 4, pct: "MANUAL", color: "ember",
      body: "A moment of defiance. Instead of waiting for the system to recover, the protagonist breaks free from it.",
      fragment: '"burn the protocol / override the silence"',
    },
    6: {
      number: "06", title: "We Remain",
      phase: "Phase: Survival", status: "SIGNAL PERSISTS",
      signal: 8, pct: "HUMAN", color: "resolve",
      body: "Silence settles after the collapse. The world is scarred and broken, but something human survives — and keeps transmitting.",
      fragment: '"after everything / we are still here / still transmitting"',
    },
  };

  /* ── State ──────────────────────────────────────────────── */
  const state = {
    soundOn: true,
    explored: new Set(),
    panelOpen: false,
    currentState: "gate",
    holding: false,
    finaleStabilised: false,
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
  const panelDecodeHint = $(".panel__decode-hint");

  /* ── Audio Engine ───────────────────────────────────────── */
  let actx = null;
  let masterGain = null;
  let droneOsc = null;
  let droneOsc2 = null;
  let noiseGain = null;
  let noiseSource = null;
  let noiseLPF = null;

  function initAudio() {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();

      masterGain = actx.createGain();
      masterGain.gain.setValueAtTime(0, actx.currentTime);
      masterGain.connect(actx.destination);

      // Drone oscillator — deep sub bass
      droneOsc = actx.createOscillator();
      droneOsc.type = "sine";
      droneOsc.frequency.setValueAtTime(42, actx.currentTime);
      const droneGain = actx.createGain();
      droneGain.gain.setValueAtTime(0.35, actx.currentTime);
      droneOsc.connect(droneGain);
      droneGain.connect(masterGain);
      droneOsc.start();

      // Second oscillator — slight detuned unease
      droneOsc2 = actx.createOscillator();
      droneOsc2.type = "sine";
      droneOsc2.frequency.setValueAtTime(42.7, actx.currentTime);
      const drone2Gain = actx.createGain();
      drone2Gain.gain.setValueAtTime(0.2, actx.currentTime);
      droneOsc2.connect(drone2Gain);
      drone2Gain.connect(masterGain);
      droneOsc2.start();

      // Filtered noise layer — atmosphere
      const bufSize = actx.sampleRate * 4;
      const noiseBuf = actx.createBuffer(1, bufSize, actx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      // Brown noise (warmer, deeper)
      let last = 0;
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }

      noiseSource = actx.createBufferSource();
      noiseSource.buffer = noiseBuf;
      noiseSource.loop = true;

      noiseLPF = actx.createBiquadFilter();
      noiseLPF.type = "lowpass";
      noiseLPF.frequency.setValueAtTime(200, actx.currentTime);
      noiseLPF.Q.setValueAtTime(0.5, actx.currentTime);

      noiseGain = actx.createGain();
      noiseGain.gain.setValueAtTime(0.15, actx.currentTime);

      noiseSource.connect(noiseLPF);
      noiseLPF.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseSource.start();
    } catch (e) {
      actx = null;
    }
  }

  function fadeAudio(vol, dur = 2) {
    if (!masterGain || !actx) return;
    masterGain.gain.cancelScheduledValues(actx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, actx.currentTime);
    masterGain.gain.linearRampToValueAtTime(vol, actx.currentTime + dur);
  }

  /* Audio reacts to hold — clean up on hold, degrade on release */
  function audioStabilise(isHolding) {
    if (!actx || !state.soundOn) return;
    if (isHolding) {
      // Clean: raise filter, reduce noise, soften drones
      if (noiseLPF) {
        noiseLPF.frequency.cancelScheduledValues(actx.currentTime);
        noiseLPF.frequency.setValueAtTime(noiseLPF.frequency.value, actx.currentTime);
        noiseLPF.frequency.linearRampToValueAtTime(80, actx.currentTime + 0.5);
      }
      if (noiseGain) {
        noiseGain.gain.cancelScheduledValues(actx.currentTime);
        noiseGain.gain.setValueAtTime(noiseGain.gain.value, actx.currentTime);
        noiseGain.gain.linearRampToValueAtTime(0.04, actx.currentTime + 0.5);
      }
    } else {
      // Degrade back
      if (noiseLPF) {
        noiseLPF.frequency.cancelScheduledValues(actx.currentTime);
        noiseLPF.frequency.setValueAtTime(noiseLPF.frequency.value, actx.currentTime);
        noiseLPF.frequency.linearRampToValueAtTime(200, actx.currentTime + 1);
      }
      if (noiseGain) {
        noiseGain.gain.cancelScheduledValues(actx.currentTime);
        noiseGain.gain.setValueAtTime(noiseGain.gain.value, actx.currentTime);
        noiseGain.gain.linearRampToValueAtTime(0.15, actx.currentTime + 1);
      }
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
    } catch (e) { /* silent fail */ }
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
    } catch (e) { /* silent fail */ }
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
    } catch (e) { /* silent fail */ }
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
  }

  /* ── Title Flash (on map entry) ─────────────────────────── */
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
    const last = Math.max(...gateLines.map((l) => parseInt(l.dataset.delay, 10) || 0));
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

  /* ── Hold Engine ────────────────────────────────────────── */
  const GATE_HOLD_TIME = 1500; // ms to hold for gate entry
  const PANEL_HOLD_TIME = 1200; // ms to hold for panel decode
  const FINALE_HOLD_TIME = 2000; // ms to hold for finale stabilise

  let holdTimer = null;
  let holdStart = 0;
  let holdRaf = null;
  let holdContext = null; // "gate" | "panel" | "finale"

  function setHolding(isHolding) {
    state.holding = isHolding;
    html.dataset.holding = String(isHolding);
    if (panel.classList.contains("is-open")) {
      panel.dataset.holding = String(isHolding);
    }
    if (state.currentState === "finale") {
      $("#finale").dataset.holding = String(isHolding);
    }
    audioStabilise(isHolding);
  }

  function startHold(context, e) {
    if (holdTimer) return;
    holdContext = context;
    holdStart = performance.now();
    setHolding(true);
    playHoldTick();

    // Show hold indicator for panel/finale
    if (context === "panel" || context === "finale") {
      holdIndicator.classList.add("is-visible");
      holdIndicatorLabel.textContent =
        context === "panel" ? "Hold to decode" : "Hold to stabilise";
    }

    // Gate progress bar
    if (context === "gate" && gateHoldZone) {
      gateHoldZone.classList.add("is-holding");
    }

    // Start progress animation
    holdRaf = requestAnimationFrame(updateHoldProgress);
  }

  function updateHoldProgress() {
    const elapsed = performance.now() - holdStart;
    let duration;
    if (holdContext === "gate") duration = GATE_HOLD_TIME;
    else if (holdContext === "panel") duration = PANEL_HOLD_TIME;
    else duration = FINALE_HOLD_TIME;

    const progress = Math.min(elapsed / duration, 1);

    // Update visuals
    if (holdContext === "gate" && gateProgress) {
      gateProgress.style.width = (progress * 100) + "%";
    }

    // Hold indicator ring (panel/finale)
    if ((holdContext === "panel" || holdContext === "finale") && holdIndicatorFill) {
      const circumference = 169.65; // 2 * PI * 27
      holdIndicatorFill.style.strokeDashoffset = String(circumference * (1 - progress));
    }

    if (progress >= 1) {
      completeHold();
      return;
    }

    holdRaf = requestAnimationFrame(updateHoldProgress);
  }

  function completeHold() {
    cancelAnimationFrame(holdRaf);
    holdRaf = null;

    if (holdContext === "gate") {
      // Enter the signal map
      if (state.soundOn) {
        initAudio();
        if (actx && actx.state === "suspended") actx.resume();
        fadeAudio(0.25, 3);
        soundBtn.setAttribute("data-active", "true");
      }
      setState("sigmap");
      resetHoldVisuals();
    } else if (holdContext === "panel") {
      // Decode the fragment — make it permanently stable
      if (panelFragment) {
        panelFragment.classList.remove("corrupted");
        panelFragment.classList.add("is-stable");
      }
      if (panelDecodeHint) {
        panelDecodeHint.classList.add("is-hidden");
      }
      resetHoldVisuals();
    } else if (holdContext === "finale") {
      // Stabilise finale quote, reveal CTA
      if (!state.finaleStabilised) {
        state.finaleStabilised = true;
        if (finaleQuote) {
          finaleQuote.classList.remove("corrupted");
          finaleQuote.classList.add("is-stable");
        }
        if (finalePrompt) {
          finalePrompt.classList.add("is-hidden");
        }
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
    holdTimer = null;
    setHolding(false);
    resetHoldVisuals();
    holdContext = null;
  }

  function resetHoldVisuals() {
    // Gate
    if (gateProgress) gateProgress.style.width = "0%";
    if (gateHoldZone) gateHoldZone.classList.remove("is-holding");

    // Hold indicator
    holdIndicator.classList.remove("is-visible");
    if (holdIndicatorFill) holdIndicatorFill.style.strokeDashoffset = "169.65";

    setHolding(false);
  }

  /* ── Gate Hold Zone ─────────────────────────────────────── */
  if (gateHoldZone) {
    gateHoldZone.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      startHold("gate", e);
    });
    gateHoldZone.addEventListener("pointerup", cancelHold);
    gateHoldZone.addEventListener("pointercancel", cancelHold);
    gateHoldZone.addEventListener("pointerleave", cancelHold);
    // Prevent context menu on long press
    gateHoldZone.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* ── Panel Hold-to-Decode ───────────────────────────────── */
  panel.addEventListener("pointerdown", (e) => {
    if (!state.panelOpen) return;
    // Don't trigger hold on close button
    if (e.target.closest(".panel__close")) return;
    e.preventDefault();
    startHold("panel", e);
  });
  panel.addEventListener("pointerup", () => {
    if (holdContext === "panel") cancelHold();
  });
  panel.addEventListener("pointercancel", () => {
    if (holdContext === "panel") cancelHold();
  });
  panel.addEventListener("contextmenu", (e) => {
    if (state.panelOpen) e.preventDefault();
  });

  /* ── Finale Hold-to-Stabilise ───────────────────────────── */
  const finaleEl = $("#finale");
  finaleEl.addEventListener("pointerdown", (e) => {
    if (state.currentState !== "finale" || state.finaleStabilised) return;
    e.preventDefault();
    startHold("finale", e);
  });
  finaleEl.addEventListener("pointerup", () => {
    if (holdContext === "finale") cancelHold();
  });
  finaleEl.addEventListener("pointercancel", () => {
    if (holdContext === "finale") cancelHold();
  });
  finaleEl.addEventListener("contextmenu", (e) => {
    if (state.currentState === "finale") e.preventDefault();
  });

  /* ── Sound Toggle ───────────────────────────────────────── */
  soundBtn.addEventListener("click", () => {
    state.soundOn = !state.soundOn;
    soundBtn.setAttribute("data-active", String(state.soundOn));
    if (state.soundOn) {
      initAudio();
      if (actx && actx.state === "suspended") actx.resume();
      fadeAudio(0.25, 1);
    } else {
      fadeAudio(0, 0.5);
    }
  });

  /* ── Node tap → open panel ──────────────────────────────── */
  nodes.forEach((node) => {
    node.addEventListener("click", () => {
      const id = parseInt(node.dataset.track, 10);
      openPanel(id, node);
    });
  });

  function openPanel(trackId, nodeEl) {
    const t = TRACKS[trackId];
    if (!t) return;

    // Set panel color scope
    panel.style.setProperty("--phase-color", `var(--${t.color === "ghost" ? "ghost-c" : t.color})`);
    panel.style.setProperty("--phase-glow", `var(--${t.color === "ghost" ? "ghost-c" : t.color})`);

    // Fill content
    $("#panel-number").textContent = t.number;
    $("#panel-phase").textContent = t.phase;
    $("#panel-pct").textContent = t.pct;
    $("#panel-title").textContent = t.title;
    $("#panel-status").textContent = t.status;
    $("#panel-body").textContent = t.body;
    $("#panel-fragment").textContent = t.fragment;

    // Reset fragment to corrupted state
    if (panelFragment) {
      panelFragment.classList.add("corrupted");
      panelFragment.classList.remove("is-stable");
    }
    if (panelDecodeHint) {
      panelDecodeHint.classList.remove("is-hidden");
    }

    // Signal bars
    renderBars($("#panel-bars"), t.signal, t.color);

    // Open
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    state.panelOpen = true;

    // Mark explored
    if (!state.explored.has(trackId)) {
      state.explored.add(trackId);
      nodeEl.classList.add("is-decoded");

      const count = state.explored.size;
      decodedCount.textContent = String(count);
      html.dataset.explored = String(count);

      // Update integrity meter
      updateIntegrity(count);

      // Audio feedback
      playNodeSound(trackId);

      // Check completion
      if (count === 6) {
        setTimeout(() => {
          closePanel();
          setTimeout(() => {
            playCompletionSound();
            fadeAudio(0.05, 4);
            setState("finale");
          }, 500);
        }, 1800);
      }
    }
  }

  function closePanel() {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    panel.dataset.holding = "false";
    state.panelOpen = false;
    // Cancel any active hold
    if (holdContext === "panel") cancelHold();
  }

  panelClose.addEventListener("click", closePanel);
  $(".panel__backdrop").addEventListener("click", closePanel);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.panelOpen) closePanel();
  });

  /* ── Signal bar renderer ────────────────────────────────── */
  function renderBars(container, filled, color) {
    const total = 8;
    const colorVar = color === "ghost" ? "var(--ghost-c)" : `var(--${color})`;
    let out = "";
    for (let i = 0; i < total; i++) {
      const on = i < filled;
      out += `<span style="
        display:inline-block; width:3px; height:${3 + i * 1.1}px;
        border-radius:1px; margin-right:1px;
        background:${on ? colorVar : "var(--line)"};
        opacity:${on ? 0.7 : 0.25};
        vertical-align:bottom;
      "></span>`;
    }
    container.innerHTML = out;
  }

  /* ── Signal integrity meter ─────────────────────────────── */
  function updateIntegrity(explored) {
    // Integrity degrades as more nodes are explored (except track 6 restores)
    const integrityMap = {
      0: { pct: 100, color: "var(--cold)" },
      1: { pct: 78, color: "var(--cold)" },
      2: { pct: 54, color: "var(--warm)" },
      3: { pct: 32, color: "var(--ghost-c)" },
      4: { pct: 8, color: "var(--critical)" },
      5: { pct: 42, color: "var(--ember)" },
      6: { pct: 100, color: "var(--resolve)" },
    };
    const info = integrityMap[explored] || integrityMap[0];
    if (integrityFill) {
      integrityFill.style.width = info.pct + "%";
      integrityFill.style.backgroundColor = info.color;
    }
    if (integrityPct) {
      integrityPct.textContent = info.pct + "%";
    }
  }

  /* ── Revisit button (finale → sigmap) ───────────────────── */
  if (revisitBtn) {
    revisitBtn.addEventListener("click", () => {
      setState("sigmap");
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  setState("gate");
  runBoot();
})();
