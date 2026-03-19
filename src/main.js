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

  /* ── Track data — canonical SoundCloud permalinks (not short links) ── */
  const TRACKS = {
    1: {
      number: "01", title: "Static Signals",
      phase: "Phase: Interference", status: "SIGNAL DETECTED",
      signal: 6, pct: "78%", color: "cold",
      body: "The first glitches appear. The world feels off — systems flicker, structures crack. Something beneath the surface is starting to fail.",
      fragment: '"the screens keep splitting / nothing holds its shape"',
      sc: {
        url: "https://soundcloud.com/officialulix/ulix-static-signals-1/s-V7ug4l0qGYr",
        start: 36000, end: 49000,
      },
    },
    2: {
      number: "02", title: "Drown Tonight",
      phase: "Phase: Submersion", status: "SIGNAL DEGRADING",
      signal: 4, pct: "54%", color: "warm",
      body: "The collapse turns inward. Noise and pressure overwhelm until breathing through the disconnection feels impossible.",
      fragment: '"sinking past the frequency / where voices used to reach"',
      sc: {
        url: "https://soundcloud.com/officialulix/ulix-drown-tonight-2/s-VYKm32cNzNZ",
        start: 82000, end: 100000,
      },
    },
    3: {
      number: "03", title: "Ghost",
      phase: "Phase: Fracture", status: "IDENTITY FRAGMENTED",
      signal: 3, pct: "32%", color: "ghost",
      body: "Still physically present, but mentally absent. Identity fractures until the self becomes a ghost inside its own life.",
      fragment: '"i\'m standing right here / but nothing registers"',
      sc: {
        url: "https://soundcloud.com/officialulix/ulix-gitfl-3/s-wPlaj8bvz0O",
        start: 11000, end: 21000,
      },
    },
    4: {
      number: "04", title: "Neon Graves",
      phase: "Phase: Collapse", status: "SIGNAL LOST",
      signal: 1, pct: "08%", color: "critical",
      body: "Total breakdown. Dead lights and lost signals turn the city into a graveyard of everything that once felt stable.",
      fragment: '"every light that burned is now a monument to what we lost"',
      sc: {
        url: "https://soundcloud.com/officialulix/ulix-neon-graves-4/s-G7K5QUeuU4G",
        start: 90000, end: 113000,
      },
    },
    5: {
      number: "05", title: "Light The Fire",
      phase: "Phase: Defiance", status: "SIGNAL OVERRIDE",
      signal: 4, pct: "MANUAL", color: "ember",
      body: "A moment of defiance. Instead of waiting for the system to recover, the protagonist breaks free from it.",
      fragment: '"burn the protocol / override the silence"',
      sc: {
        url: "https://soundcloud.com/officialulix/ulix-light-the-fire-5/s-3vfkGU9Nx9l",
        start: 36000, end: 49000,
      },
    },
    6: {
      number: "06", title: "We Remain",
      phase: "Phase: Survival", status: "SIGNAL PERSISTS",
      signal: 8, pct: "HUMAN", color: "resolve",
      body: "Silence settles after the collapse. The world is scarred and broken, but something human survives — and keeps transmitting.",
      fragment: '"after everything / we are still here / still transmitting"',
      sc: {
        url: "https://soundcloud.com/officialulix/ulix-we-remain-6/s-cVut0hn7zJA",
        start: 101000, end: 112000,
      },
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
  const panelFallback = $("#panel-fallback");
  const panelFallbackLink = $("#panel-fallback-link");
  const finaleEl = $("#finale");

  /* ═══════════════════════════════════════════════════════════
     SOUNDCLOUD WIDGET ENGINE — hardened async module
     ═══════════════════════════════════════════════════════════ */

  const scEngine = {
    apiLoaded: false,
    apiPromise: null,
    widgets: {},       // { [trackId]: { widget, iframe, ready, failed, readyPromise, resolveReady } }
    fadeInterval: null,
    stopTimer: null,
    pendingPlay: null,  // trackId queued for play once ready

    /**
     * Step 1: Ensure the SC Widget API script is loaded and SC.Widget exists.
     * Returns a promise that resolves when window.SC.Widget is available.
     */
    loadWidgetAPI() {
      if (this.apiPromise) return this.apiPromise;

      this.apiPromise = new Promise((resolve) => {
        // Check if already loaded
        if (window.SC && window.SC.Widget) {
          log("SC Widget API already available");
          this.apiLoaded = true;
          resolve(true);
          return;
        }

        // Check if the script tag exists but hasn't loaded yet
        const existing = document.querySelector('script[src*="w.soundcloud.com/player/api.js"]');

        const onLoad = () => {
          // Poll briefly for SC.Widget — the script may define it async
          let attempts = 0;
          const check = () => {
            if (window.SC && window.SC.Widget) {
              log("SC Widget API loaded successfully");
              this.apiLoaded = true;
              resolve(true);
            } else if (attempts < 50) {
              attempts++;
              setTimeout(check, 100);
            } else {
              log("SC Widget API failed to define SC.Widget after script load");
              resolve(false);
            }
          };
          check();
        };

        if (existing) {
          // Script tag exists — might still be loading
          if (existing.hasAttribute("data-loaded")) {
            onLoad();
          } else {
            existing.addEventListener("load", () => {
              existing.setAttribute("data-loaded", "true");
              onLoad();
            });
            existing.addEventListener("error", () => {
              log("SC Widget API script failed to load");
              resolve(false);
            });
          }
        } else {
          // No script tag — inject one
          const script = document.createElement("script");
          script.src = "https://w.soundcloud.com/player/api.js";
          script.onload = () => {
            script.setAttribute("data-loaded", "true");
            onLoad();
          };
          script.onerror = () => {
            log("SC Widget API script injection failed");
            resolve(false);
          };
          document.head.appendChild(script);
        }
      });

      return this.apiPromise;
    },

    /**
     * Step 2: Create widget for a specific track.
     * Returns the widget entry with a readyPromise.
     */
    createWidget(trackId) {
      const id = String(trackId);
      if (this.widgets[id]) return this.widgets[id];

      const t = TRACKS[trackId];
      if (!t) return null;

      const container = $("#sc-players");
      if (!container) return null;

      // Create iframe with canonical permalink
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
      log("iframe created: track", id, t.title);

      // Create widget from iframe
      const widget = SC.Widget(iframe);

      // Build entry with a promise that resolves on READY
      let resolveReady;
      const readyPromise = new Promise((resolve) => {
        resolveReady = resolve;
      });

      const entry = {
        widget,
        iframe,
        ready: false,
        failed: false,
        fadingOut: false,
        readyPromise,
        resolveReady,
      };

      this.widgets[id] = entry;

      // Bind READY — clears any prior ERROR (SC fires ERROR before READY for private tracks)
      widget.bind(SC.Widget.Events.READY, () => {
        entry.ready = true;
        entry.failed = false; // READY overrides earlier ERROR
        log("widget READY: track", id, t.title);
        resolveReady(true);

        // If playback was queued for this track, fire it now
        if (this.pendingPlay === trackId) {
          this.pendingPlay = null;
          log("executing queued playback for track", id);
          this.playPreview(trackId);
        }
      });

      // Bind ERROR — only mark failed if READY hasn't already fired
      widget.bind(SC.Widget.Events.ERROR, () => {
        log("widget ERROR: track", id, t.title);
        if (!entry.ready) {
          entry.failed = true;
          resolveReady(false);
        }
      });

      // Safety timeout — if READY doesn't fire in 15s, mark failed
      setTimeout(() => {
        if (!entry.ready && !entry.failed) {
          log("widget TIMEOUT: track", id, "— no READY after 15s");
          entry.failed = true;
          resolveReady(false);
        }
      }, 15000);

      return entry;
    },

    /**
     * Step 3: Wait for a specific track's widget to be ready.
     * Returns true if ready, false if failed.
     */
    async waitForReady(trackId) {
      const id = String(trackId);
      const entry = this.widgets[id];
      if (!entry) return false;
      if (entry.ready) return true;
      if (entry.failed) return false;
      return entry.readyPromise;
    },

    /**
     * Initialize all 6 widgets after API is confirmed loaded.
     */
    async initAll() {
      const apiOk = await this.loadWidgetAPI();
      if (!apiOk) {
        log("SC Widget API not available — all tracks will use fallback");
        return;
      }

      log("creating widgets for all 6 tracks...");
      for (const id of Object.keys(TRACKS)) {
        this.createWidget(parseInt(id, 10));
      }
    },

    /**
     * Play preview for a track. Handles: stop others, wait for ready,
     * seek, volume 0, play, fade in, schedule fade out at end.
     */
    async playPreview(trackId) {
      if (!state.soundOn) return;

      const id = String(trackId);
      const t = TRACKS[trackId];
      if (!t) return;

      // Stop any currently playing track
      this.stopAllPreviews();

      const entry = this.widgets[id];
      if (!entry) {
        log("no widget for track", id, "— fallback");
        playNodeSound(trackId);
        showFallback(trackId);
        return;
      }

      // If not ready yet, queue playback (will fire when READY arrives)
      if (!entry.ready) {
        if (entry.failed) {
          log("widget failed for track", id, "— fallback");
          playNodeSound(trackId);
          showFallback(trackId);
          return;
        }
        log("widget not ready yet for track", id, "— queuing playback");
        this.pendingPlay = trackId;
        return;
      }

      log("playPreview: track", id, t.title, "from", t.sc.start, "to", t.sc.end);
      state.activeTrack = trackId;
      entry.fadingOut = false;

      try {
        entry.widget.setVolume(0);
        log("setVolume(0) called: track", id);

        entry.widget.seekTo(t.sc.start);
        log("seekTo called:", t.sc.start, "track", id);

        entry.widget.play();
        log("play() called: track", id);
      } catch (e) {
        log("playPreview error:", e.message, "track", id);
        playNodeSound(trackId);
        showFallback(trackId);
        return;
      }

      // Fade in volume over ~500ms
      let vol = 0;
      clearInterval(this.fadeInterval);
      log("volume fade-in started: track", id);
      this.fadeInterval = setInterval(() => {
        vol = Math.min(vol + 5, 100);
        try { entry.widget.setVolume(vol); } catch (e) { /* ignore */ }
        if (vol >= 100) {
          clearInterval(this.fadeInterval);
          log("volume fade-in complete: track", id);
        }
      }, 25);

      // Schedule fade-out before end timestamp
      const clipLen = t.sc.end - t.sc.start;
      const maxDuration = 20000;
      const playDuration = Math.min(clipLen, maxDuration);
      const fadeOutAt = Math.max(playDuration - 800, 0);

      clearTimeout(this.stopTimer);
      this.stopTimer = setTimeout(() => {
        log("stop timer fired: track", id);
        this.stopPreview(trackId);
      }, fadeOutAt);
    },

    /**
     * Fade out and stop a specific track.
     */
    stopPreview(trackId) {
      const id = String(trackId);
      const entry = this.widgets[id];
      if (!entry || !entry.ready) return;
      if (entry.fadingOut) return;
      entry.fadingOut = true;

      clearInterval(this.fadeInterval);
      clearTimeout(this.stopTimer);

      log("fade-out started: track", id);
      let vol = 100;
      this.fadeInterval = setInterval(() => {
        vol = Math.max(vol - 5, 0);
        try { entry.widget.setVolume(vol); } catch (e) { /* ignore */ }
        if (vol <= 0) {
          clearInterval(this.fadeInterval);
          try { entry.widget.pause(); } catch (e) { /* ignore */ }
          if (state.activeTrack === trackId) state.activeTrack = null;
          log("fade-out complete, paused: track", id);
        }
      }, 25);
    },

    /**
     * Immediately stop all previews.
     */
    stopAllPreviews() {
      clearTimeout(this.stopTimer);
      clearInterval(this.fadeInterval);
      this.pendingPlay = null;

      if (state.activeTrack !== null) {
        const id = String(state.activeTrack);
        const entry = this.widgets[id];
        if (entry && entry.ready) {
          try {
            entry.widget.setVolume(0);
            entry.widget.pause();
          } catch (e) { /* ignore */ }
        }
        log("stopped active track:", id);
        state.activeTrack = null;
      }
    },

    /**
     * Check if a track's widget is in a usable state.
     */
    isTrackReady(trackId) {
      const entry = this.widgets[String(trackId)];
      return entry ? entry.ready : false;
    },

    isTrackFailed(trackId) {
      const entry = this.widgets[String(trackId)];
      return entry ? entry.failed : false;
    },
  };

  /**
   * Show fallback UI inside the panel for a track whose widget failed.
   */
  function showFallback(trackId) {
    const t = TRACKS[trackId];
    if (!t || !panelFallback || !panelFallbackLink) return;
    panelFallbackLink.href = t.sc.url;
    panelFallback.removeAttribute("hidden");
    log("fallback shown for track", trackId);
  }

  function hideFallback() {
    if (panelFallback) panelFallback.setAttribute("hidden", "");
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
    } catch (e) { /* ignore */ }
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
      // Kick off SC engine — fully async, does not block UI
      scEngine.initAll();
    }
    if (name === "finale") {
      scEngine.stopAllPreviews();
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

      // Play SC audio — async, handles queuing if widget not ready
      if (trackId) {
        log("unlock triggered playback for track", trackId);
        scEngine.playPreview(trackId);
      }

      resetHoldVisuals();

      // Check completion → finale
      if (state.explored.size === 6) {
        setTimeout(() => {
          closePanel();
          setTimeout(() => {
            scEngine.stopAllPreviews();
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

    // Stop any playing preview when opening a new panel
    scEngine.stopAllPreviews();

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

    // Show/hide fallback based on widget state
    hideFallback();
    if (scEngine.isTrackFailed(trackId)) {
      showFallback(trackId);
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
    if (!state.soundOn) scEngine.stopAllPreviews();
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
