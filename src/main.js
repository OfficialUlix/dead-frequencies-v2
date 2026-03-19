/* ═══════════════════════════════════════════════════════════════
   DEAD FREQUENCIES v2 — Experience Engine
   Gate → Boot → Descent → Phases → Message → End
   ═══════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ── State ──────────────────────────────────────────────── */
  const state = {
    soundOn: true,
    gateOpen: false,
    currentPhase: 0,
    totalPhases: 6,
  };

  /* ── DOM refs ───────────────────────────────────────────── */
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];

  const gate = $("#gate");
  const gateLines = $$(".gate__line");
  const gateActions = $(".gate__actions");
  const gateEnter = $(".gate__enter");
  const gateVersion = $(".gate__version");
  const soundChoices = $$(".gate__sound-choice");
  const experience = $("#experience");
  const titleReveal = $(".title-reveal");
  const soundToggle = $(".sound-toggle");
  const signalMeter = $(".signal-meter");
  const meterFill = $(".signal-meter__fill");
  const meterLabel = $(".signal-meter__label");
  const phases = $$(".phase");
  const message = $(".message");
  const endscreen = $(".endscreen");

  /* ── Audio context (lazy init) ──────────────────────────── */
  let audioCtx = null;
  let ambientNode = null;
  let ambientGain = null;

  function initAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      ambientGain = audioCtx.createGain();
      ambientGain.gain.value = 0;
      ambientGain.connect(audioCtx.destination);

      // Dark ambient drone — filtered noise
      const bufferSize = 2 * audioCtx.sampleRate;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      ambientNode = audioCtx.createBufferSource();
      ambientNode.buffer = noiseBuffer;
      ambientNode.loop = true;

      // Heavy low-pass for deep rumble
      const lpf = audioCtx.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = 120;
      lpf.Q.value = 0.7;

      // Subtle resonance
      const resonance = audioCtx.createBiquadFilter();
      resonance.type = "bandpass";
      resonance.frequency.value = 55;
      resonance.Q.value = 5;

      ambientNode.connect(lpf);
      lpf.connect(resonance);
      resonance.connect(ambientGain);

      ambientNode.start();
    } catch (e) {
      // Audio not available — silent fallback
    }
  }

  function setAmbientVolume(vol, duration = 2) {
    if (!ambientGain) return;
    ambientGain.gain.linearRampToValueAtTime(
      vol,
      audioCtx.currentTime + duration
    );
  }

  /* ── Gate: Boot sequence ────────────────────────────────── */
  function runBootSequence() {
    gateLines.forEach((line) => {
      const delay = parseInt(line.dataset.delay, 10) || 0;
      setTimeout(() => line.classList.add("is-typed"), delay);
    });

    // Reveal actions after last line
    const lastDelay = Math.max(...gateLines.map((l) => parseInt(l.dataset.delay, 10) || 0));

    setTimeout(() => {
      gateActions.classList.add("is-revealed");
    }, lastDelay + 600);

    setTimeout(() => {
      gateEnter.classList.add("is-revealed");
    }, lastDelay + 1000);
  }

  /* ── Gate: Sound choice ─────────────────────────────────── */
  soundChoices.forEach((btn) => {
    btn.addEventListener("click", () => {
      soundChoices.forEach((b) => b.classList.remove("gate__sound-choice--active"));
      btn.classList.add("gate__sound-choice--active");
      state.soundOn = btn.dataset.sound === "on";
    });
  });

  /* ── Gate: Enter experience ─────────────────────────────── */
  gateEnter.addEventListener("click", () => {
    if (state.gateOpen) return;
    state.gateOpen = true;

    // Init audio if sound on
    if (state.soundOn) {
      initAudio();
      setAmbientVolume(0.08, 3);
      soundToggle.setAttribute("data-active", "true");
    }

    // Transition out gate
    gate.classList.add("is-exiting");

    setTimeout(() => {
      gate.classList.add("is-hidden");
      document.documentElement.classList.add("experience-started");
      experience.classList.add("is-active");
      titleReveal.classList.add("is-active");

      // Show persistent UI
      soundToggle.classList.add("is-visible");

      // Start observing phases
      initScrollObservers();
    }, 900);
  });

  /* ── Sound toggle (persistent) ──────────────────────────── */
  soundToggle.addEventListener("click", () => {
    state.soundOn = !state.soundOn;
    soundToggle.setAttribute("data-active", state.soundOn.toString());

    if (state.soundOn) {
      initAudio();
      setAmbientVolume(0.08, 1);
    } else {
      setAmbientVolume(0, 0.5);
    }
  });

  /* ── Scroll observation — phase visibility ──────────────── */
  function initScrollObservers() {
    // Phases
    const phaseObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            const phaseNum = parseInt(entry.target.dataset.phase, 10);
            updateEnvironment(phaseNum);
          }
        });
      },
      { threshold: 0.25, rootMargin: "0px 0px -10% 0px" }
    );

    phases.forEach((p) => phaseObserver.observe(p));

    // Message
    const msgObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            msgObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    if (message) msgObserver.observe(message);

    // Endscreen
    const endObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            endObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    if (endscreen) endObserver.observe(endscreen);

    // Signal meter — show after scrolling past title
    const meterTrigger = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            signalMeter.classList.add("is-visible");
          } else {
            signalMeter.classList.remove("is-visible");
          }
        });
      },
      { threshold: 0.5 }
    );
    if (titleReveal) meterTrigger.observe(titleReveal);

    // Scroll-hint hide
    const scrollCue = $(".title-reveal__scroll-cue");
    if (scrollCue) {
      let cueHidden = false;
      window.addEventListener(
        "scroll",
        () => {
          if (!cueHidden && window.scrollY > 100) {
            scrollCue.style.opacity = "0";
            scrollCue.style.transition = "opacity 0.5s ease";
            cueHidden = true;
          }
        },
        { passive: true }
      );
    }
  }

  /* ── Environment mutations per phase ────────────────────── */
  function updateEnvironment(phaseNum) {
    if (phaseNum === state.currentPhase) return;
    state.currentPhase = phaseNum;

    // Update signal meter
    const progress = (phaseNum / state.totalPhases) * 100;
    if (meterFill) meterFill.style.height = progress + "%";
    if (meterLabel) meterLabel.textContent = `0${phaseNum} / 06`;

    // Update meter color to match phase
    const phaseEl = $(`[data-phase="${phaseNum}"]`);
    if (phaseEl) {
      const phaseColor = getComputedStyle(phaseEl).getPropertyValue("--phase-color").trim();
      if (meterFill && phaseColor) {
        meterFill.style.backgroundColor = phaseColor;
        meterFill.style.boxShadow = `0 0 8px ${phaseColor}40`;
      }
    }

    // Grain intensity shifts
    const grainMap = { 1: 0.18, 2: 0.22, 3: 0.15, 4: 0.35, 5: 0.2, 6: 0.12 };
    document.documentElement.style.setProperty(
      "--grain-intensity",
      grainMap[phaseNum] || 0.18
    );

    // Scanline speed shift — faster during critical phases
    const scanEl = $(".atmos__scanline");
    if (scanEl) {
      const scanSpeed = phaseNum === 4 ? "4s" : phaseNum === 3 ? "6s" : "8s";
      scanEl.style.animationDuration = scanSpeed;
    }

    // Ambient audio pitch/volume shift
    if (state.soundOn && ambientGain) {
      const volMap = { 1: 0.06, 2: 0.1, 3: 0.05, 4: 0.15, 5: 0.08, 6: 0.03 };
      setAmbientVolume(volMap[phaseNum] || 0.06, 1.5);
    }
  }

  /* ── Title micro-glitch ─────────────────────────────────── */
  const titlePrimary = $(".title-reveal__primary");
  if (titlePrimary) {
    function triggerMicroGlitch() {
      const dx = (Math.random() - 0.5) * 3;
      const dy = (Math.random() - 0.5) * 1.5;
      titlePrimary.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      titlePrimary.style.opacity = (0.82 + Math.random() * 0.18).toString();

      setTimeout(() => {
        titlePrimary.style.transform = "";
        titlePrimary.style.opacity = "";
      }, 50 + Math.random() * 70);

      setTimeout(triggerMicroGlitch, 4000 + Math.random() * 6000);
    }

    setTimeout(triggerMicroGlitch, 3000);
  }

  /* ── Parallax on title orbs (desktop only) ──────────────── */
  const titleSection = $(".title-reveal");
  const orbs = $$(".title-reveal__orb");

  if (titleSection && orbs.length && window.matchMedia("(pointer: fine)").matches) {
    let ticking = false;
    titleSection.addEventListener("mousemove", (e) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = titleSection.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        orbs.forEach((orb, i) => {
          const depth = (i + 1) * 10;
          orb.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0)`;
        });
        ticking = false;
      });
    });
  }

  /* ── Scar line glow on proximity (desktop) ──────────────── */
  const scarLine = $(".title-reveal__scar");
  if (scarLine && titleSection && window.matchMedia("(pointer: fine)").matches) {
    titleSection.addEventListener("mousemove", (e) => {
      const rect = titleSection.getBoundingClientRect();
      const y = (e.clientY - rect.top) / rect.height;
      const proximity = 1 - Math.abs(y - 0.45) * 2.5;
      scarLine.style.opacity = Math.max(0.3, Math.min(1, proximity)).toString();
    });
  }

  /* ── Render signal bars in phase headers ─────────────────── */
  $$(".phase__signal-bar").forEach((el) => {
    const total = 8;
    const filled = parseInt(el.style.getPropertyValue("--bars"), 10) || 0;
    let html = "";
    for (let i = 0; i < total; i++) {
      const active = i < filled;
      html += `<span style="
        display:inline-block;
        width:3px;
        height:${4 + i * 1.2}px;
        border-radius:1px;
        margin-right:1px;
        background:${active ? "var(--phase-color)" : "var(--line)"};
        opacity:${active ? 0.7 : 0.3};
        vertical-align:bottom;
      "></span>`;
    }
    el.innerHTML = html;
  });

  /* ── Init ────────────────────────────────────────────────── */
  runBootSequence();
})();
