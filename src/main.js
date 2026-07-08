const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

const TRACKS = [
  {
    number: "01",
    title: "STATIC SIGNALS",
    fragment: "A track about first contact with the collapse. When the noise outside starts matching the noise inside. It is the moment a broken signal becomes recognisably human.",
    frequency: "086.7 MHz",
    src: "audio/static-signals.mp3",
    start: 36,
    end: 69,
  },
  {
    number: "02",
    title: "DROWN TONIGHT",
    fragment: "A track about pressure, numbness, and losing control while trying to keep breathing through it. It feels like sinking, but not surrendering.",
    frequency: "094.2 MHz",
    src: "audio/drown-tonight.mp3",
    start: 82,
    end: 110,
  },
  {
    number: "03",
    title: "GHOST",
    fragment: "A track about absence that still has weight. People, memories, and versions of yourself that refuse to fully leave. It is grief answering back through static.",
    frequency: "101.9 MHz",
    src: "audio/ghost.mp3",
    start: 11,
    end: 31,
  },
  {
    number: "04",
    title: "NEON GRAVES",
    fragment: "A track about dead cities, artificial light, and the strange beauty of places that kept glowing after they stopped feeling alive. It turns nightlife into a cemetery of memories.",
    frequency: "113.4 MHz",
    src: "audio/neon-graves.mp3",
    start: 90,
    end: 123,
  },
  {
    number: "05",
    title: "LIGHT THE FIRE",
    fragment: "A track about the first return of willpower after collapse. Anger becoming warmth, survival becoming motion. It is the ignition point where the signal stops begging and starts burning.",
    frequency: "127.8 MHz",
    src: "audio/light-the-fire.mp3",
    start: 36,
    end: 59,
  },
  {
    number: "06",
    title: "WE REMAIN",
    fragment: "A track about what survives after everything else fails: connection, loyalty, and the refusal to disappear. It is the final proof that the signal was never just noise.",
    frequency: "144.0 MHz",
    src: "audio/we-remain.mp3",
    start: 101,
    end: 117,
  },
];

const INTEGRITY = [0, 18, 32, 49, 66, 84, 100];
const HOLD = {
  preboot: 1450,
  gate: 1650,
  panel: 900,
  finale: 1500,
};
const RING_LENGTH = 628.319;
const SOUNDCLOUD_URL = "https://soundcloud.com/officialulix/sets/dead-frequencies-ep/s-2C5xUiZAUcY?si=5020ca7b6da746ec98c100a862eee543";

const html = document.documentElement;
const body = document.body;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const canvas = $("#signal-canvas");
const ctx = canvas?.getContext("2d");

const refs = {
  state: $("#state-readout"),
  count: $("#count-readout"),
  integrity: $("#integrity-readout"),
  lock: $("#lock-readout"),
  carrier: $("#carrier-readout"),
  frequency: $("#frequency-readout"),
  fragment: $("#fragment-readout"),
  coreLabel: $("#core-label"),
  coreAction: $("#core-action"),
  coreSub: $("#core-sub"),
  gateHold: $("#gate-hold"),
  gateProgress: $("#gate-progress"),
  nodes: $$(".node"),
  panel: $("#panel"),
  panelClose: $("#panel-close"),
  panelNumber: $("#panel-number"),
  panelStatus: $("#panel-status"),
  panelTitle: $("#panel-title"),
  panelFragment: $("#panel-fragment"),
  panelFrequency: $("#panel-frequency"),
  panelIntegrity: $("#panel-integrity"),
  panelHold: $("#panel-hold"),
  panelProgress: $("#panel-progress"),
  panelHoldLabel: $("#panel-hold-label"),
  listen: $(".listen-link"),
  boot: $("#preboot"),
  bootLines: $$("[data-boot-line]"),
  prebootHold: $("#preboot-hold"),
  prebootProgress: $("#preboot-progress"),
  finaleLineA: $("#finale-line-a"),
  finaleLineB: $("#finale-line-b"),
  finaleHoldWrap: $("#finale-hold-wrap"),
  finaleHold: $("#finale-hold"),
  finaleProgress: $("#finale-progress"),
  finaleReveal: $("#finale-reveal"),
  finaleTitle: $("#finale-title"),
  finaleActions: $("#finale-actions"),
  replay: $("#replay-button"),
  view: $("#view-button"),
};

const app = {
  state: "preboot",
  activeTrack: null,
  recovered: new Set(),
  holding: false,
  holdContext: null,
  holdStart: 0,
  holdRaf: 0,
  holdProgress: 0,
  targetEnergy: 0.12,
  energy: 0.12,
  audioTrack: null,
  pendingFinale: false,
  finalePrimed: false,
  finaleDecoded: false,
  prebootReady: false,
  bootTimers: [],
};

const bootText = refs.bootLines.map((line) => line.textContent);

let audio = null;
let audioContext = null;
let mediaSource = null;
let clipFilter = null;
let clipGain = null;
let audioFadeFrame = 0;
let audioStopTimer = 0;
let audioUnlocked = false;
let noiseBuffer = null;
let tactileIndex = -1;
let droneOsc = null;
let droneNoise = null;
let droneGain = null;
let droneFilter = null;
let raf = 0;
let lastFrame = 0;

function countRecovered() {
  return app.recovered.size;
}

function integrityForCount(count) {
  return INTEGRITY[Math.max(0, Math.min(INTEGRITY.length - 1, count))];
}

function setText(node, value) {
  if (node) node.textContent = value;
}

function setGateRing(value) {
  if (!refs.gateProgress) return;
  refs.gateProgress.style.strokeDashoffset = String(RING_LENGTH * (1 - Math.max(0, Math.min(1, value))));
}

function setPrebootFill(value) {
  if (!refs.prebootProgress) return;
  refs.prebootProgress.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function setPanelFill(value) {
  if (!refs.panelProgress) return;
  refs.panelProgress.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function setFinaleFill(value) {
  if (!refs.finaleProgress) return;
  refs.finaleProgress.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function corrupt(text, amount) {
  if (amount <= 0) return text;
  const marks = ["_", "/", ".", ":"];
  return text
    .split("")
    .map((char, index) => {
      if (char === " " || char === "." || char === ",") return char;
      return index % amount === 0 ? marks[index % marks.length] : char;
    })
    .join("");
}

function terminalGlitch(text, progress) {
  const glyphs = ["#", "%", "/", "_", ".", ":", "0", "1", "+", "="];
  const clarity = Math.max(0, Math.min(1, progress));
  const scramble = Math.max(2, Math.round(10 - clarity * 8));
  const jitter = Math.floor(performance.now() / 48);

  return text
    .split("")
    .map((char, index) => {
      if (char === " " || char === "." || char === "," || char === ":") return char;
      const shouldReveal = index / Math.max(1, text.length) < clarity * 0.95;
      if (clarity < 0.18) return glyphs[(index * 3 + jitter) % glyphs.length];
      if (shouldReveal && (index + jitter) % 9 !== 0) return char;
      if ((index + jitter) % scramble === 0) return glyphs[(index + jitter) % glyphs.length];
      return shouldReveal ? char : glyphs[(index + jitter * 2) % glyphs.length];
    })
    .join("");
}

function resolveTerminalText(node, text, duration = 900, onDone, options = {}) {
  if (!node) {
    if (onDone) onDone();
    return;
  }

  if (reducedMotion.matches && !options.force) {
    setText(node, text);
    if (onDone) onDone();
    return;
  }

  const start = performance.now();
  node.classList.add("is-glitching");

  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    setText(node, terminalGlitch(text, progress));
    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }
    setText(node, text);
    node.classList.remove("is-glitching");
    if (onDone) onDone();
  }

  requestAnimationFrame(frame);
}

function revealFinaleLine(node, text, delay, duration, onDone) {
  window.setTimeout(() => {
    if (!node) {
      if (onDone) onDone();
      return;
    }
    node.classList.add("is-visible", "is-glitching");
    setText(node, terminalGlitch(text, 0));
    resolveTerminalText(node, text, duration, () => {
      if (onDone) onDone();
    }, { force: true });
  }, delay);
}

function ensureAudio() {
  if (audio) return audio;

  audio = new Audio();
  audio.preload = "auto";
  audio.volume = 1;
  audio.addEventListener("timeupdate", () => {
    if (app.audioTrack === null) return;
    const track = TRACKS[app.audioTrack];
    if (track && audio.currentTime >= track.end) {
      fadeOutClip();
    }
  });
  audio.addEventListener("ended", () => {
    app.audioTrack = null;
    app.targetEnergy = app.state === "panel" ? 0.58 : 0.45;
  });
  return audio;
}

function ensureAudioContext() {
  if (audioContext) return audioContext;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;

  audioContext = new AudioCtor();
  const player = ensureAudio();
  mediaSource = audioContext.createMediaElementSource(player);
  clipFilter = audioContext.createBiquadFilter();
  clipFilter.type = "lowpass";
  clipFilter.frequency.value = 520;
  clipFilter.Q.value = 0.9;
  clipGain = audioContext.createGain();
  clipGain.gain.value = 0;
  mediaSource.connect(clipFilter);
  clipFilter.connect(clipGain);
  clipGain.connect(audioContext.destination);
  return audioContext;
}

function resumeAudioContext() {
  const context = ensureAudioContext();
  if (context && context.state === "suspended") {
    context.resume().catch(() => {});
  }
  return context;
}

function unlockAudio() {
  const player = ensureAudio();
  resumeAudioContext();
  if (audioUnlocked) return;

  player.muted = true;
  player.volume = 0;
  const attempt = player.play();
  if (attempt && attempt.then) {
    attempt
      .then(() => {
        player.pause();
        player.muted = false;
        player.volume = 1;
        player.currentTime = 0;
        audioUnlocked = true;
      })
      .catch(() => {
        player.muted = false;
        player.volume = 1;
        audioUnlocked = true;
      });
  } else {
    audioUnlocked = true;
  }
}

function prepareClip(index, shouldStart) {
  const track = TRACKS[index];
  if (!track) return;

  const player = ensureAudio();
  resumeAudioContext();
  clearTimeout(audioStopTimer);
  cancelAnimationFrame(audioFadeFrame);

  if (player.dataset.track !== String(index)) {
    player.src = track.src;
    player.dataset.track = String(index);
  }

  try {
    player.currentTime = track.start;
  } catch (error) {
    player.addEventListener("loadedmetadata", () => {
      player.currentTime = track.start;
    }, { once: true });
  }

  if (clipGain) clipGain.gain.value = 0;
  if (clipFilter) clipFilter.frequency.value = 430;
  player.volume = 0;
  app.audioTrack = index;

  if (shouldStart) {
    player.play().catch(() => {});
  }
}

function animateClip(targetGain, targetFrequency, duration, onDone) {
  cancelAnimationFrame(audioFadeFrame);
  const context = audioContext;
  const fromGain = clipGain ? clipGain.gain.value : 0;
  const fromFrequency = clipFilter ? clipFilter.frequency.value : targetFrequency;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = progress * progress * (3 - 2 * progress);
    if (clipGain) clipGain.gain.value = fromGain + (targetGain - fromGain) * eased;
    if (clipFilter) clipFilter.frequency.value = fromFrequency + (targetFrequency - fromFrequency) * eased;
    if (progress < 1) {
      audioFadeFrame = requestAnimationFrame(frame);
    } else if (onDone) {
      onDone();
    }
  }

  if (context) {
    frame(performance.now());
  } else if (onDone) {
    window.setTimeout(onDone, duration);
  }
}

function playRecoveredClip(index) {
  const track = TRACKS[index];
  if (!track) return;
  const player = ensureAudio();
  resumeAudioContext();
  prepareClip(index, false);
  player.muted = false;
  player.volume = 1;

  const playPromise = player.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch(() => {});
  }

  app.audioTrack = index;
  app.targetEnergy = 0.94;
  duckDrone();
  animateClip(0.92, 15000, 650);

  const duration = Math.max(0.6, track.end - track.start);
  audioStopTimer = window.setTimeout(() => {
    fadeOutClip();
  }, Math.max(0, duration * 1000 - 900));
}

function fadeOutClip(onDone) {
  clearTimeout(audioStopTimer);
  if (!audio || audio.paused) {
    if (onDone) onDone();
    return;
  }

  animateClip(0, 420, 760, () => {
    audio.pause();
    audio.currentTime = 0;
    app.audioTrack = null;
    app.targetEnergy = app.state === "finale" ? 0.82 : 0.46;
    restoreDrone();
    if (onDone) onDone();
  });
}

function stopClip() {
  clearTimeout(audioStopTimer);
  cancelAnimationFrame(audioFadeFrame);
  if (clipGain) clipGain.gain.value = 0;
  if (clipFilter) clipFilter.frequency.value = 430;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  app.audioTrack = null;
  restoreDrone();
}

function createNoiseBuffer() {
  const context = resumeAudioContext();
  if (!context || noiseBuffer) return noiseBuffer;

  const length = context.sampleRate * 0.35;
  noiseBuffer = context.createBuffer(1, length, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function pulseHoldSound(intensity) {
  const context = resumeAudioContext();
  if (!context) return;

  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(36 + intensity * 42, context.currentTime);
  gain.gain.setValueAtTime(0.012 + intensity * 0.032, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.07 + intensity * 0.05);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + 0.14);
}

function playLockSound() {
  const context = resumeAudioContext();
  if (!context) return;

  const click = context.createOscillator();
  const clickGain = context.createGain();
  click.type = "square";
  click.frequency.setValueAtTime(1200, context.currentTime);
  click.frequency.exponentialRampToValueAtTime(190, context.currentTime + 0.045);
  clickGain.gain.setValueAtTime(0.055, context.currentTime);
  clickGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.07);
  click.connect(clickGain);
  clickGain.connect(context.destination);
  click.start();
  click.stop(context.currentTime + 0.08);

  const sub = context.createOscillator();
  const subGain = context.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(48, context.currentTime + 0.02);
  subGain.gain.setValueAtTime(0.045, context.currentTime + 0.02);
  subGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
  sub.connect(subGain);
  subGain.connect(context.destination);
  sub.start(context.currentTime + 0.02);
  sub.stop(context.currentTime + 0.16);
}

function playGlitchBurst() {
  const context = resumeAudioContext();
  const buffer = createNoiseBuffer();
  if (!context || !buffer) return;

  for (let i = 0; i < 4; i += 1) {
    const time = context.currentTime + i * 0.055;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(560 + i * 430, time);
    filter.Q.setValueAtTime(2.2, time);
    gain.gain.setValueAtTime(0.045, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(time);
    source.stop(time + 0.055);
  }
}

function updateHoldTactile(progress) {
  const thresholds = [0.15, 0.3, 0.45, 0.6, 0.72, 0.82, 0.9, 0.95];
  for (let index = 0; index < thresholds.length; index += 1) {
    if (progress >= thresholds[index] && tactileIndex < index) {
      tactileIndex = index;
      pulseHoldSound(0.28 + index * 0.08);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(Math.round(5 + index * 2));
        } catch (error) {}
      }
    }
  }
}

function resetTactile() {
  tactileIndex = -1;
}

function startDrone() {
  const context = resumeAudioContext();
  if (!context || droneOsc) return;

  const buffer = createNoiseBuffer();
  droneGain = context.createGain();
  droneGain.gain.value = 0;
  droneFilter = context.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 180;
  droneFilter.Q.value = 0.55;

  droneOsc = context.createOscillator();
  droneOsc.type = "sine";
  droneOsc.frequency.value = 44;
  droneOsc.connect(droneFilter);

  if (buffer) {
    droneNoise = context.createBufferSource();
    droneNoise.buffer = buffer;
    droneNoise.loop = true;
    droneNoise.connect(droneFilter);
  }

  droneFilter.connect(droneGain);
  droneGain.connect(context.destination);
  droneOsc.start();
  if (droneNoise) droneNoise.start();
  restoreDrone();
}

function setDroneLevel(value, duration = 0.8) {
  if (!droneGain || !audioContext) return;
  const now = audioContext.currentTime;
  droneGain.gain.cancelScheduledValues(now);
  droneGain.gain.setValueAtTime(droneGain.gain.value, now);
  droneGain.gain.linearRampToValueAtTime(value, now + duration);
}

function duckDrone() {
  setDroneLevel(0.003, 0.45);
}

function restoreDrone() {
  if (app.state === "gate") return;
  setDroneLevel(0.018, 1.2);
}

function stopDrone() {
  if (!audioContext) return;
  setDroneLevel(0, 0.4);
  window.setTimeout(() => {
    try {
      if (droneOsc) droneOsc.stop();
      if (droneNoise) droneNoise.stop();
    } catch (error) {}
    droneOsc = null;
    droneNoise = null;
    droneGain = null;
    droneFilter = null;
  }, 450);
}

function updateProgressUI() {
  const count = countRecovered();
  const integrity = integrityForCount(count);

  html.dataset.explored = String(count);
  body.dataset.explored = String(count);
  setText(refs.count, String(count));
  setText(refs.integrity, `${integrity}% INTEGRITY`);

  refs.nodes.forEach((node) => {
    const index = Number(node.dataset.track);
    const recovered = app.recovered.has(index);
    const active = app.activeTrack === index;
    const track = TRACKS[index];
    node.classList.toggle("is-recovered", recovered);
    node.classList.toggle("is-active", active);
    node.setAttribute(
      "aria-label",
      `${track.number} ${track.title}, ${track.frequency}, ${recovered ? "recovered" : "locked"}`
    );
  });

  if (app.state === "sigmap") {
    setText(refs.fragment, count === 6 ? "FINAL MESSAGE READY" : "SELECT FREQUENCY");
  }
}

function setMachineState(next) {
  app.state = next;
  html.dataset.state = next;
  body.dataset.state = next;
  if (next === "finale") {
    html.dataset.final = app.finaleDecoded ? "decoded" : "sequence";
    body.dataset.final = app.finaleDecoded ? "decoded" : "sequence";
  } else {
    delete html.dataset.final;
    delete body.dataset.final;
  }

  if (refs.listen) {
    const gated = next === "preboot" || next === "gate";
    refs.listen.setAttribute("aria-disabled", String(gated));
    refs.listen.tabIndex = gated ? -1 : 0;
  }

  if (next === "preboot") {
    refs.boot?.setAttribute("aria-hidden", "false");
    app.targetEnergy = 0.1;
  }

  if (next === "gate") {
    refs.boot?.setAttribute("aria-hidden", "true");
    setText(refs.state, "SIGNAL LOST");
    setText(refs.lock, "LOCK: UNSTABLE");
    setText(refs.carrier, "CARRIER: NONE");
    setText(refs.frequency, "--.- MHz");
    setText(refs.fragment, "MANUAL RECOVERY REQUIRED");
    setText(refs.coreLabel, "DF-06");
    setText(refs.coreAction, "HOLD TO BEGIN");
    setText(refs.coreSub, "TRANSMISSION");
    refs.panel?.setAttribute("aria-hidden", "true");
    app.targetEnergy = 0.22;
  }

  if (next === "sigmap") {
    refs.boot?.setAttribute("aria-hidden", "true");
    const count = countRecovered();
    setText(refs.state, count === 6 ? "ALL SIGNALS DECODED" : "SIGNAL ACTIVE");
    setText(refs.lock, count === 6 ? "LOCK: COMPLETE" : "LOCK: PARTIAL");
    setText(refs.carrier, "CARRIER: FOUND");
    setText(refs.frequency, app.activeTrack === null ? "SCAN READY" : TRACKS[app.activeTrack].frequency);
    setText(refs.fragment, count === 6 ? "FINAL MESSAGE READY" : "SELECT FREQUENCY");
    setText(refs.coreLabel, count === 6 ? "100%" : "NODE ACTIVE");
    setText(refs.coreAction, count === 6 ? "FINAL" : "TUNE");
    setText(refs.coreSub, count === 6 ? "MESSAGE UNLOCKED" : "RECOVER FRAGMENTS");
    refs.panel?.setAttribute("aria-hidden", "true");
    app.targetEnergy = 0.42 + count * 0.07;
  }

  if (next === "panel") {
    refs.panel?.setAttribute("aria-hidden", "false");
    setText(refs.state, "TUNING");
    setText(refs.lock, "LOCK: MANUAL");
    setText(refs.carrier, "CARRIER: NARROW");
    setText(refs.coreLabel, app.activeTrack === null ? "NODE" : TRACKS[app.activeTrack].number);
    setText(refs.coreAction, "HOLD");
    setText(refs.coreSub, "RECOVER FRAGMENT");
    app.targetEnergy = 0.56 + (app.activeTrack ?? 0) * 0.035;
  }

  if (next === "finale") {
    refs.panel?.setAttribute("aria-hidden", "true");
    setText(refs.state, app.finaleDecoded ? "WE REMAIN" : "FINAL MESSAGE LOCKED");
    setText(refs.lock, "LOCK: HUMAN");
    setText(refs.carrier, "CARRIER: RESIDUAL");
    setText(refs.frequency, "144.0 MHz");
    setText(refs.fragment, app.finaleDecoded ? "MESSAGE STABLE" : "STABILISE FINAL MESSAGE");
    setText(refs.coreLabel, app.finaleDecoded ? "6/6" : "DF-06");
    setText(refs.coreAction, app.finaleDecoded ? "ONE" : "HOLD");
    setText(refs.coreSub, app.finaleDecoded ? "SIGNAL STABLE" : "FINAL MESSAGE");
    app.targetEnergy = app.finaleDecoded ? 0.96 : 0.78;
  }

  updateProgressUI();
}

function syncPanel(index) {
  const track = TRACKS[index];
  const recovered = app.recovered.has(index);
  const nextCount = recovered ? countRecovered() : Math.min(6, countRecovered() + 1);

  refs.panelHold?.classList.remove("is-holding");
  setPanelFill(0);
  setText(refs.panelNumber, track.number);
  setText(refs.panelStatus, recovered ? "RECOVERED" : countRecovered() > 0 ? "PARTIAL" : "CORRUPTED");
  setText(refs.panelTitle, track.title);
  setText(refs.panelFragment, recovered ? track.fragment : corrupt(track.fragment, 4));
  setText(refs.panelFrequency, track.frequency);
  setText(refs.panelIntegrity, `${integrityForCount(nextCount)}% TARGET`);
  setText(refs.frequency, track.frequency);
  setText(refs.fragment, recovered ? "FRAGMENT RECOVERED" : "FRAGMENT DETECTED");
  setText(refs.panelHoldLabel, recovered ? "FRAGMENT RECOVERED / CLIP ARMED" : "HOLD TO RECOVER FRAGMENT");

  if (refs.panelHold) {
    refs.panelHold.disabled = false;
    refs.panelHold.setAttribute("aria-disabled", String(recovered));
    refs.panelHold.classList.toggle("is-recovered", recovered);
    refs.panelHold.tabIndex = recovered ? -1 : 0;
  }
  refs.panelFragment?.classList.toggle("corrupted", !recovered);
  refs.panelFragment?.classList.toggle("is-stable", recovered);
  setPanelFill(recovered ? 1 : 0);
  updateProgressUI();
}

function openPanel(index) {
  if (app.state !== "sigmap") return;
  app.activeTrack = index;
  syncPanel(index);
  setMachineState("panel");
}

function closePanel() {
  if (app.state !== "panel") return;
  cancelHold();
  refs.panelHold?.classList.remove("is-holding");
  if (refs.panelHold) {
    refs.panelHold.tabIndex = 0;
  }
  const shouldEnterFinale = app.pendingFinale;
  app.pendingFinale = false;
  fadeOutClip(() => {
    if (shouldEnterFinale) {
      enterFinale();
    } else {
      app.activeTrack = null;
      setMachineState("sigmap");
    }
  });
}

function clearBootIntro() {
  app.bootTimers.forEach((timer) => window.clearTimeout(timer));
  app.bootTimers = [];
  app.prebootReady = false;
  refs.boot?.classList.remove("is-ready", "is-complete");
  refs.bootLines.forEach((line, index) => {
    line.classList.remove("is-visible", "is-glitching");
    setText(line, bootText[index] || "");
  });
  refs.prebootHold?.classList.remove("is-holding");
  setPrebootFill(0);
  refs.boot?.setAttribute("aria-hidden", "true");
}

function queueBootStep(callback, delay) {
  const timer = window.setTimeout(callback, delay);
  app.bootTimers.push(timer);
  return timer;
}

function runPreboot() {
  clearBootIntro();
  refs.boot?.setAttribute("aria-hidden", "false");
  setMachineState("preboot");

  if (reducedMotion.matches) {
    refs.bootLines.forEach((line) => line.classList.add("is-visible"));
    queueBootStep(markPrebootReady, 550);
    return;
  }

  const lineDelay = 410;
  const firstDelay = 220;

  refs.bootLines.forEach((line, index) => {
    const text = bootText[index] || "";
    queueBootStep(() => {
      line.classList.add("is-visible");
      setText(line, terminalGlitch(text, 0));
      resolveTerminalText(line, text, index === refs.bootLines.length - 1 ? 620 : 480, null, { force: true });
      if (index === 3 || index === 6) playGlitchBurst();
    }, firstDelay + index * lineDelay);
  });

  queueBootStep(markPrebootReady, firstDelay + refs.bootLines.length * lineDelay + 760);
}

function markPrebootReady() {
  if (app.state !== "preboot") return;
  app.prebootReady = true;
  refs.boot?.classList.add("is-ready");
  playGlitchBurst();
  setPrebootFill(0);
}

function armAudioForTransmission() {
  const player = ensureAudio();
  player.muted = false;
  player.volume = 1;
  resumeAudioContext();
  audioUnlocked = true;
}

function completePrebootHold() {
  setPrebootFill(1);
  refs.boot?.classList.add("is-complete");
  armAudioForTransmission();
  playGlitchBurst();
  queueBootStep(() => {
    refs.boot?.setAttribute("aria-hidden", "true");
    setMachineState("sigmap");
    startDrone();
  }, reducedMotion.matches ? 80 : 620);
}

function completeGateHold() {
  setGateRing(1);
  refs.boot?.setAttribute("aria-hidden", "true");
  armAudioForTransmission();
  playGlitchBurst();
  setMachineState("sigmap");
  startDrone();
}

function recoverActiveFragment() {
  if (app.activeTrack === null) return;
  if (app.recovered.has(app.activeTrack)) return;

  app.recovered.add(app.activeTrack);
  syncPanel(app.activeTrack);
  updateProgressUI();
  app.targetEnergy = 0.66 + countRecovered() * 0.055;
  setText(refs.panelHoldLabel, "FRAGMENT RECOVERED / PLAYING");
  playRecoveredClip(app.activeTrack);

  if (countRecovered() === TRACKS.length) {
    app.pendingFinale = true;
    setText(refs.fragment, "FINAL MESSAGE HELD");
  }
}

function resetFinaleSequence() {
  app.finalePrimed = false;
  app.finaleDecoded = false;
  refs.finaleLineA?.classList.remove("is-visible");
  refs.finaleLineB?.classList.remove("is-visible");
  refs.finaleHoldWrap?.classList.remove("is-visible");
  refs.finaleReveal?.classList.remove("is-visible");
  refs.finaleActions?.classList.remove("is-visible");
  setText(refs.finaleLineA, "ALL SIGNALS DECODED");
  setText(refs.finaleLineB, "RESIDUAL FREQUENCY DETECTED");
  setText(refs.finaleTitle, "WE REMAIN");
  setFinaleFill(0);
}

function enterFinale() {
  cancelHold();
  stopClip();
  restoreDrone();
  app.activeTrack = null;
  resetFinaleSequence();
  setMachineState("finale");
  updateProgressUI();

  const firstDelay = reducedMotion.matches ? 40 : 260;
  const secondDelay = reducedMotion.matches ? 160 : 1180;
  const holdDelay = reducedMotion.matches ? 320 : 2340;

  revealFinaleLine(refs.finaleLineA, "ALL SIGNALS DECODED", firstDelay, 860);
  revealFinaleLine(refs.finaleLineB, "RESIDUAL FREQUENCY DETECTED", secondDelay, 980);
  window.setTimeout(() => {
    app.finalePrimed = true;
    refs.finaleHoldWrap?.classList.add("is-visible");
    setText(refs.state, "HOLD TO STABILISE");
  }, holdDelay);
}

function decodeFinale() {
  app.finaleDecoded = true;
  refs.finaleHoldWrap?.classList.remove("is-visible");
  refs.finaleLineA?.classList.remove("is-visible");
  refs.finaleLineB?.classList.remove("is-visible");
  refs.finaleReveal?.classList.add("is-visible");
  setText(refs.finaleTitle, terminalGlitch("WE REMAIN", 0));
  setMachineState("finale");
  resolveTerminalText(refs.finaleTitle, "WE REMAIN", 1450, null, { force: true });
  window.setTimeout(() => {
    if (app.finaleDecoded) refs.finaleActions?.classList.add("is-visible");
  }, reducedMotion.matches ? 80 : 1200);
}

function startHold(context) {
  if (app.holding) return;
  if (context === "preboot" && (app.state !== "preboot" || !app.prebootReady)) return;
  if (context === "gate" && app.state !== "gate") return;
  if (context === "panel" && (app.state !== "panel" || app.activeTrack === null || app.recovered.has(app.activeTrack))) return;
  if (context === "finale" && (app.state !== "finale" || !app.finalePrimed || app.finaleDecoded)) return;

  app.holding = true;
  app.holdContext = context;
  app.holdStart = performance.now();
  app.holdProgress = 0;
  html.dataset.holding = "true";
  body.dataset.holding = "true";
  unlockAudio();
  resetTactile();
  refs.prebootHold?.classList.toggle("is-holding", context === "preboot");
  refs.gateHold?.classList.toggle("is-holding", context === "gate");
  refs.panelHold?.classList.toggle("is-holding", context === "panel");
  refs.finaleHold?.classList.toggle("is-holding", context === "finale");

  if (context === "preboot") {
    unlockAudio();
    playGlitchBurst();
  }
  if (context === "gate") {
    playGlitchBurst();
    setText(refs.state, "CARRIER DETECTED");
    setText(refs.coreAction, "HOLD");
    setText(refs.coreSub, "DO NOT RELEASE");
  }
  if (context === "panel") {
    prepareClip(app.activeTrack, true);
    playGlitchBurst();
    setText(refs.panelHoldLabel, "RECOVERING 0%");
    setText(refs.fragment, "SIGNAL NARROWING");
  }
  if (context === "finale") {
    playGlitchBurst();
    setText(refs.state, "STABILISING");
  }

  app.holdRaf = requestAnimationFrame(updateHold);
}

function updateHold(now) {
  const duration = HOLD[app.holdContext] || HOLD.gate;
  const progress = Math.min(1, (now - app.holdStart) / duration);
  app.holdProgress = progress;

  if (app.holdContext === "gate") {
    updateHoldTactile(progress);
    setGateRing(progress);
    app.targetEnergy = 0.18 + progress * 0.62;
    if (progress < 0.25) {
      setText(refs.state, "SIGNAL LOST");
      setText(refs.carrier, "CARRIER: SEARCHING");
    } else if (progress < 0.55) {
      setText(refs.state, "CARRIER DETECTED");
      setText(refs.carrier, "CARRIER: FAINT");
    } else if (progress < 0.88) {
      setText(refs.state, "LOCKING");
      setText(refs.carrier, "CARRIER: FORMING");
    } else {
      setText(refs.state, "SIGNAL ACTIVE");
      setText(refs.carrier, "CARRIER: FOUND");
    }
  }

  if (app.holdContext === "preboot") {
    updateHoldTactile(progress);
    setPrebootFill(progress);
    app.targetEnergy = 0.16 + progress * 0.58;
  }

  if (app.holdContext === "panel") {
    updateHoldTactile(progress);
    setPanelFill(progress);
    app.targetEnergy = 0.55 + progress * 0.36;
    setText(refs.panelHoldLabel, `RECOVERING ${Math.round(progress * 100)}%`);
    if (app.activeTrack !== null) {
      setText(refs.panelFragment, terminalGlitch(TRACKS[app.activeTrack].fragment, progress));
      refs.panelFragment?.classList.add("is-glitching");
    }
  }

  if (app.holdContext === "finale") {
    updateHoldTactile(progress);
    setFinaleFill(progress);
    app.targetEnergy = 0.76 + progress * 0.22;
  }

  if (progress >= 1) {
    finishHold();
    return;
  }
  app.holdRaf = requestAnimationFrame(updateHold);
}

function finishHold() {
  const context = app.holdContext;
  cancelAnimationFrame(app.holdRaf);
  app.holdRaf = 0;
  app.holding = false;
  app.holdContext = null;
  html.dataset.holding = "false";
  body.dataset.holding = "false";
  refs.gateHold?.classList.remove("is-holding");
  refs.prebootHold?.classList.remove("is-holding");
  refs.panelHold?.classList.remove("is-holding");
  refs.finaleHold?.classList.remove("is-holding");
  refs.panelFragment?.classList.remove("is-glitching");
  resetTactile();
  playLockSound();

  if (context === "preboot") completePrebootHold();
  if (context === "gate") completeGateHold();
  if (context === "panel") recoverActiveFragment();
  if (context === "finale") decodeFinale();
}

function cancelHold() {
  if (!app.holding) return;
  const context = app.holdContext;
  cancelAnimationFrame(app.holdRaf);
  app.holdRaf = 0;
  app.holding = false;
  app.holdContext = null;
  html.dataset.holding = "false";
  body.dataset.holding = "false";
  refs.gateHold?.classList.remove("is-holding");
  refs.prebootHold?.classList.remove("is-holding");
  refs.panelHold?.classList.remove("is-holding");
  refs.finaleHold?.classList.remove("is-holding");
  refs.panelFragment?.classList.remove("is-glitching");
  resetTactile();

  if (context === "preboot") {
    setPrebootFill(0);
  }
  if (context === "gate") {
    setGateRing(0);
    setMachineState("gate");
  }
  if (context === "panel") {
    stopClip();
    setPanelFill(0);
    syncPanel(app.activeTrack);
    setMachineState("panel");
  }
  if (context === "finale") {
    setFinaleFill(0);
    setText(refs.state, "RESIDUAL FREQUENCY DETECTED");
  }
}

function bindHold(target, context) {
  if (!target) return;
  let pointerId = null;

  target.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") return;
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    pointerId = event.pointerId;
    target.setPointerCapture?.(event.pointerId);
    startHold(context);
  });
  target.addEventListener("pointerup", (event) => {
    if (event.pointerType === "touch") return;
    target.releasePointerCapture?.(event.pointerId);
    pointerId = null;
    cancelHold();
  });
  target.addEventListener("pointercancel", (event) => {
    if (event.pointerType === "touch") return;
    pointerId = null;
    cancelHold();
  });
  target.addEventListener("lostpointercapture", (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    cancelHold();
  });
  target.addEventListener("touchstart", (event) => {
    event.preventDefault();
    startHold(context);
  }, { passive: false });
  target.addEventListener("touchend", (event) => {
    event.preventDefault();
    cancelHold();
  }, { passive: false });
  target.addEventListener("touchcancel", (event) => {
    event.preventDefault();
    cancelHold();
  }, { passive: false });
  target.addEventListener("contextmenu", (event) => event.preventDefault());
  target.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      startHold(context);
    }
  });
  target.addEventListener("keyup", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      cancelHold();
    }
  });
}

function suppressTouchHighlight() {
  const interactive = "button, a, .node, .preboot-hold, .core-node, .recover-hold, .finale-hold-button, .panel__close, .finale-action";
  const holdControl = ".preboot-hold, .core-node, .recover-hold, .finale-hold-button";

  document.addEventListener("touchstart", (event) => {
    const target = event.target.closest(interactive);
    if (!target) return;
    target.blur?.();
    if (target.matches(holdControl)) {
      event.preventDefault();
    }
  }, { passive: false, capture: true });

  document.addEventListener("touchend", (event) => {
    const target = event.target.closest(interactive);
    if (!target) return;
    target.blur?.();
  }, { passive: true, capture: true });
}

function replaySignal() {
  clearBootIntro();
  stopClip();
  stopDrone();
  app.activeTrack = null;
  app.recovered.clear();
  app.audioTrack = null;
  app.pendingFinale = false;
  app.targetEnergy = 0.12;
  resetFinaleSequence();
  setGateRing(0);
  setPanelFill(0);
  runPreboot();
}

function viewTransmissions() {
  cancelHold();
  stopClip();
  restoreDrone();
  app.finaleDecoded = false;
  app.pendingFinale = false;
  refs.finaleReveal?.classList.remove("is-visible");
  refs.finaleHoldWrap?.classList.remove("is-visible");
  setMachineState("sigmap");
}

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.7);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawNoise(width, height, time) {
  const count = reducedMotion.matches ? 90 : 360;
  const countFactor = 1 - countRecovered() * 0.09;

  ctx.save();
  ctx.globalAlpha = Math.max(0.04, (app.state === "gate" ? 0.22 : 0.14) * countFactor);
  ctx.fillStyle = "#f0e5d2";
  for (let i = 0; i < count; i += 1) {
    const sx = Math.sin(i * 129.17 + time * 0.002) * 43758.5453;
    const sy = Math.sin(i * 97.73 + time * 0.003) * 24634.6345;
    ctx.fillRect((sx - Math.floor(sx)) * width, (sy - Math.floor(sy)) * height, i % 19 === 0 ? 2 : 1, 1);
  }
  ctx.restore();
}

function drawRadial(width, height, time) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const base = Math.min(width, height) * 0.17;
  const count = countRecovered();
  const lock = app.state === "gate" ? 0.12 : 0.48 + count * 0.07;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(reducedMotion.matches ? -0.12 : -0.12 + time * 0.00008);

  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, base * (0.76 + i * 0.23), 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 === 0
      ? `rgba(150, 127, 97, ${0.045 + lock * 0.075})`
      : `rgba(212, 72, 47, ${0.075 + lock * 0.105})`;
    ctx.lineWidth = Math.max(1, width * 0.001);
    ctx.setLineDash(i > 2 ? [Math.max(8, width * 0.008), Math.max(10, width * 0.011)] : []);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(-base * 2.1, 0);
  ctx.lineTo(base * 2.1, 0);
  ctx.strokeStyle = `rgba(159, 113, 69, ${0.12 + app.energy * 0.16})`;
  ctx.stroke();
  ctx.restore();
}

function drawWave(width, height, time) {
  const yBase = height * 0.515;
  const count = countRecovered();
  const resolved = app.state === "finale" && app.finaleDecoded;
  const amp = height * (resolved ? 0.028 : 0.02 + app.energy * 0.065);
  const broken = resolved ? 0.05 : 1 - count / 8;
  const trackOffset = (app.activeTrack ?? 0) * 0.74;

  for (let line = 0; line < 3; line += 1) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 5) {
      const envelope = Math.sin((x / width) * Math.PI);
      const dropout = app.state === "gate" && x % 55 < 12 ? broken * 18 : 0;
      const y = yBase + line * height * 0.034 + (
        Math.sin(x * (0.017 + count * 0.0007) + time * 0.002 + trackOffset) +
        Math.sin(x * 0.047 - time * 0.0011 + line * 1.4) * broken
      ) * amp * envelope + dropout;

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = line === 0
      ? `rgba(212, 72, 47, ${0.42 + app.energy * 0.3})`
      : `rgba(150, 127, 97, ${0.075 + app.energy * 0.13})`;
    ctx.lineWidth = line === 0 ? 2 : 1;
    ctx.stroke();
  }
}

function drawSpectrum(width, height, time) {
  const bars = 48;
  const start = width * 0.18;
  const end = width * 0.82;
  const bottom = height * 0.79;
  const maxHeight = height * (0.04 + countRecovered() * 0.008);
  const active = app.activeTrack ?? 0;

  for (let i = 0; i < bars; i += 1) {
    const phase = i * 1.37 + active * 0.8 + time * 0.002;
    const value = Math.sin(phase) * 0.5 + 0.5;
    const x = start + ((end - start) * i) / (bars - 1);
    const h = 5 + value * maxHeight * (0.36 + app.energy);
    ctx.fillStyle = i % 6 === active
      ? "rgba(212, 72, 47, 0.52)"
      : "rgba(150, 127, 97, 0.12)";
    ctx.fillRect(x, bottom - h, Math.max(1, width * 0.0024), h);
  }
}

function render(time = 0) {
  if (!ctx || !canvas) return;

  if (reducedMotion.matches && time - lastFrame < 420) {
    raf = requestAnimationFrame(render);
    return;
  }

  lastFrame = time;
  resizeCanvas();
  app.energy += (app.targetEnergy - app.energy) * 0.045;

  const width = canvas.width;
  const height = canvas.height;
  const count = countRecovered();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#030302";
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.5, height * 0.5, height * 0.04, width * 0.5, height * 0.5, height * 0.55);
  glow.addColorStop(0, `rgba(212, 72, 47, ${0.07 + app.energy * 0.16})`);
  glow.addColorStop(0.42, `rgba(159, 113, 69, ${0.025 + count * 0.008})`);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  drawRadial(width, height, time);
  drawWave(width, height, time);
  drawSpectrum(width, height, time);
  drawNoise(width, height, time);

  raf = requestAnimationFrame(render);
}

bindHold(refs.prebootHold, "preboot");
bindHold(refs.gateHold, "gate");
bindHold(refs.panelHold, "panel");
bindHold(refs.finaleHold, "finale");

refs.nodes.forEach((node) => {
  node.addEventListener("click", () => openPanel(Number(node.dataset.track)));
});

refs.panelClose?.addEventListener("click", closePanel);
refs.replay?.addEventListener("click", replaySignal);
refs.view?.addEventListener("click", viewTransmissions);

window.addEventListener("resize", resizeCanvas);
window.addEventListener("pagehide", () => {
  clearBootIntro();
  cancelAnimationFrame(raf);
  cancelAnimationFrame(app.holdRaf);
  stopClip();
});

$$('a[href="' + SOUNDCLOUD_URL + '"]').forEach((link) => {
  link.rel = "noreferrer";
});

setGateRing(0);
setPanelFill(0);
setFinaleFill(0);
body.dataset.holding = "false";
suppressTouchHighlight();
runPreboot();
resizeCanvas();
raf = requestAnimationFrame(render);
