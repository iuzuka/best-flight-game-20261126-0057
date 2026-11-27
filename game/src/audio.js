// Every sound is synthesised with WebAudio: an engine drone that follows the throttle, wind
// that rises with speed, and short cues for rings, parcels, hits, landings and the win. No
// audio file is loaded and nothing plays before the first user gesture (the browser's rule),
// so the audio context is created lazily and every call is safe when it is not there yet.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOscA = null;
  let engineOscB = null;
  let engineGain = null;
  let windGain = null;
  let windSource = null;
  let muted = false;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context !== null;
    }
    try {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      // Engine: two detuned saws through a low-pass, quiet until the game starts.
      engineOscA = context.createOscillator();
      engineOscA.type = 'sawtooth';
      engineOscA.frequency.value = 82;
      engineOscB = context.createOscillator();
      engineOscB.type = 'sawtooth';
      engineOscB.frequency.value = 82.7;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOscA.connect(filter);
      engineOscB.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOscA.start();
      engineOscB.start();
      // Wind: a looped noise buffer through a band-pass, gain follows speed.
      const length = context.sampleRate;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = context.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      const windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 640;
      windFilter.Q.value = 0.6;
      windGain = context.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function tone(frequency, duration, type, volume, when = 0, slideTo = null) {
    if (context === null || master === null) return;
    try {
      const start = context.currentTime + when;
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    } catch {
      // A cue that fails to play must never break the game.
    }
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master !== null && context !== null) master.gain.setTargetAtTime(value ? 0 : 0.5, context.currentTime, 0.05);
    },
    get muted() {
      return muted;
    },
    /** Called every frame while flying: drone pitch and wind follow speed and throttle. */
    setEngine(speedKt, boosting) {
      if (context === null || engineOscA === null || engineGain === null || windGain === null) return;
      try {
        const base = 58 + speedKt * 0.28 + (boosting ? 26 : 0);
        engineOscA.frequency.setTargetAtTime(base, context.currentTime, 0.08);
        engineOscB.frequency.setTargetAtTime(base * 1.008, context.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(0.05 + speedKt * 0.00016, context.currentTime, 0.1);
        windGain.gain.setTargetAtTime(Math.max(0, (speedKt - 130) * 0.00045), context.currentTime, 0.15);
      } catch {
        // Ignore audio errors mid-flight.
      }
    },
    ring() {
      tone(880, 0.5, 'sine', 0.22, 0, 1318);
      tone(1318, 0.4, 'sine', 0.14, 0.07);
    },
    parcel() {
      tone(660, 0.16, 'triangle', 0.2);
      tone(990, 0.2, 'triangle', 0.16, 0.06);
    },
    hit() {
      tone(160, 0.4, 'sawtooth', 0.3, 0, 55);
      tone(90, 0.5, 'square', 0.2, 0.02, 40);
    },
    warn() {
      tone(1180, 0.12, 'square', 0.1);
    },
    land() {
      [523, 659, 784, 1047].forEach((freq, index) => tone(freq, 0.35, 'triangle', 0.18, index * 0.11));
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((freq, index) => tone(freq, 0.5, 'triangle', 0.18, index * 0.13));
    },
    over() {
      [392, 330, 262, 196].forEach((freq, index) => tone(freq, 0.45, 'sawtooth', 0.14, index * 0.16));
    },
  };
}
