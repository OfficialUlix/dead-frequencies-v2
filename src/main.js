/* ═══════════════════════════════════════════════════════════════
   DEAD FREQUENCIES — Transmission Experience Engine
   State Machine: gate → handshake → sigmap → (panel) → finale
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
  };

  /* ── DOM ────────────────────────────────────────────────── */
  const html = document.documentElement;
  const gateLines = $$(".gate__line");
  const gateControls = $(".gate__controls");
  const gateEnterBtn = $(".gate__enter");
  const gateSndBtns = $$(".gate__snd");
  const soundBtn = $(".sound-btn");
  const handshakeProceed = $(".handshake__proceed");
  const nodes = $$(".node");
  const panel = $("#panel");
  const panelClose = $(".panel__close");
  const decodedCount = $("#decoded-count");
  const revisitBtn = $("#revisit-btn");

  /* ── Audio Engine ───────────────────────────────────────── */
  let actx = null;
  let masterGain = null;
  let droneOsc = null;
  let droneOsc2 = null;
  let noiseGain = null;
  let noiseSource = null;

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

      const noiseLPF = actx.createBiquadFilter();
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
      // Audio not available — degrade gracefully
      actx = null;
    }
  }

  function fadeAudio(vol, dur = 2) {
    if (!masterGain || !actx) return;
    masterGain.gain.cancelScheduledValues(actx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, actx.currentTime);
    masterGain.gain.linearRampToValueAtTime(vol, actx.currentTime + dur);
  }

  function playNodeSound(trackNum) {
    if (!actx || !state.soundOn) return;
    try {
      // Short tonal ping matching the track's emotional register
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
      // Resolved chord — C major spread
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

  /* ── State Machine ──────────────────────────────────────── */
  function setState(name) {
    html.dataset.state = name;

    if (name === "handshake" || name === "sigmap" || name === "finale") {
      soundBtn.classList.add("is-visible");
    }
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

  /* ── Gate Enter ─────────────────────────────────────────── */
  gateEnterBtn.addEventListener("click", () => {
    if (state.soundOn) {
      initAudio();
      if (actx && actx.state === "suspended") actx.resume();
      fadeAudio(0.25, 3);
      soundBtn.setAttribute("data-active", "true");
    }
    setState("handshake");
  });

  /* ── Handshake → Signal Map ─────────────────────────────── */
  handshakeProceed.addEventListener("click", () => {
    setState("sigmap");
  });

  /* ── Sound Toggle (persistent) ──────────────────────────── */
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
    state.panelOpen = false;
  }

  panelClose.addEventListener("click", closePanel);
  $(".panel__backdrop").addEventListener("click", closePanel);

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.panelOpen) closePanel();
  });

  /* ── Signal bar renderer ────────────────────────────────── */
  function renderBars(container, filled, color) {
    const total = 8;
    const colorVar = color === "ghost" ? "var(--ghost-c)" : `var(--${color})`;
    let html = "";
    for (let i = 0; i < total; i++) {
      const on = i < filled;
      html += `<span style="
        display:inline-block; width:3px; height:${3 + i * 1.1}px;
        border-radius:1px; margin-right:1px;
        background:${on ? colorVar : "var(--line)"};
        opacity:${on ? 0.7 : 0.25};
        vertical-align:bottom;
      "></span>`;
    }
    container.innerHTML = html;
  }

  /* ── Revisit button (finale → sigmap) ───────────────────── */
  if (revisitBtn) {
    revisitBtn.addEventListener("click", () => {
      setState("sigmap");
    });
  }

  /* ── Title micro-glitch (handshake) ─────────────────────── */
  const titlePrimary = $(".handshake__primary");
  if (titlePrimary) {
    (function glitch() {
      if (html.dataset.state !== "handshake") {
        return setTimeout(glitch, 2000);
      }
      const dx = (Math.random() - 0.5) * 3;
      const dy = (Math.random() - 0.5) * 1.5;
      titlePrimary.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      titlePrimary.style.opacity = String(0.82 + Math.random() * 0.18);
      setTimeout(() => {
        titlePrimary.style.transform = "";
        titlePrimary.style.opacity = "";
      }, 50 + Math.random() * 70);
      setTimeout(glitch, 3500 + Math.random() * 5000);
    })();
  }

  /* ── Parallax on handshake orbs (desktop) ───────────────── */
  const hs = $(".handshake");
  const orbs = $$(".handshake__orb");
  if (hs && orbs.length && window.matchMedia("(pointer: fine)").matches) {
    let ticking = false;
    hs.addEventListener("mousemove", (e) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const r = hs.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        orbs.forEach((o, i) => {
          const d = (i + 1) * 10;
          o.style.transform = `translate3d(${x * d}px, ${y * d}px, 0)`;
        });
        ticking = false;
      });
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  setState("gate");
  runBoot();
})();
