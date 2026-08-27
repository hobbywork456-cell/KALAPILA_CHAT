// Web Audio API Sound Generator for Video & Audio Calls
// Generates realistic calling ringtones, incoming alerts, and call state tones
class CallSoundManager {
  constructor() {
    this.audioCtx = null;
    this.activeNodes = [];
    this.intervalId = null;
    this.timeoutId = null;
  }

  getAudioContext() {
    if (!this.audioCtx || this.audioCtx.state === "closed") {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // 1. OUTGOING RINGBACK TONE (Dual-tone cadence 440Hz + 480Hz)
  playOutgoingRing() {
    this.stopAllSounds();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const playBurst = () => {
      try {
        if (!this.audioCtx || this.audioCtx.state === "closed") return;
        const now = ctx.currentTime;
        const duration = 1.2;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gainNode.gain.setValueAtTime(0.08, now + duration - 0.05);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);
        gainNode.connect(ctx.destination);

        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(440, now);
        osc1.connect(gainNode);

        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(480, now);
        osc2.connect(gainNode);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);

        this.activeNodes.push(osc1, osc2, gainNode);
      } catch (e) {
        console.warn("Error playing outgoing ring:", e);
      }
    };

    playBurst();
    this.intervalId = setInterval(playBurst, 3000);
  }

  // 2. INCOMING CALL RINGTONE (Pleasant melodic loop)
  playIncomingRing() {
    this.stopAllSounds();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const melodyNotes = [
      { freq: 659.25, time: 0.0, dur: 0.12 }, // E5
      { freq: 830.61, time: 0.14, dur: 0.12 }, // G#5
      { freq: 987.77, time: 0.28, dur: 0.14 }, // B5
      { freq: 1318.51, time: 0.44, dur: 0.22 }, // E6
      { freq: 987.77, time: 0.70, dur: 0.12 }, // B5
      { freq: 1318.51, time: 0.85, dur: 0.30 }, // E6
      { freq: 1108.73, time: 1.25, dur: 0.18 }, // C#6
      { freq: 987.77, time: 1.45, dur: 0.25 }, // B5
    ];

    const playMelodyCycle = () => {
      try {
        if (!this.audioCtx || this.audioCtx.state === "closed") return;
        const baseTime = ctx.currentTime;

        melodyNotes.forEach(({ freq, time, dur }) => {
          const startTime = baseTime + time;
          const stopTime = startTime + dur;

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, stopTime);
          gain.connect(ctx.destination);

          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, startTime);
          osc.connect(gain);

          osc.start(startTime);
          osc.stop(stopTime);
          this.activeNodes.push(osc, gain);
        });
      } catch (e) {
        console.warn("Error playing incoming ringtone:", e);
      }
    };

    playMelodyCycle();
    this.intervalId = setInterval(playMelodyCycle, 2400);
  }

  // 3. CALL CONNECTED SOUND (Short sweet chime)
  playConnectedSound() {
    this.stopAllSounds();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [
        { freq: 523.25, time: 0, dur: 0.15 }, // C5
        { freq: 659.25, time: 0.12, dur: 0.2 }, // E5
        { freq: 783.99, time: 0.26, dur: 0.35 }, // G5
      ].forEach(({ freq, time, dur }) => {
        const t = now + time;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        gain.connect(ctx.destination);

        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t);
        osc.connect(gain);

        osc.start(t);
        osc.stop(t + dur);
      });
    } catch (e) {
      console.warn("Connected sound error:", e);
    }
  }

  // 4. CALL ENDED TONE (Descending double tone)
  playEndedSound() {
    this.stopAllSounds();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [
        { freq: 440, time: 0, dur: 0.18 }, // A4
        { freq: 349.23, time: 0.15, dur: 0.25 }, // F4
      ].forEach(({ freq, time, dur }) => {
        const t = now + time;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        gain.connect(ctx.destination);

        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);
        osc.connect(gain);

        osc.start(t);
        osc.stop(t + dur);
      });
    } catch (e) {
      console.warn("Ended sound error:", e);
    }
  }

  // 5. CALL BUSY / REJECTED TONE (Three rapid beeps)
  playBusySound() {
    this.stopAllSounds();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [0, 0.2, 0.4].forEach((offset) => {
        const t = now + offset;
        const dur = 0.12;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
        gain.gain.setValueAtTime(0.12, t + dur - 0.01);
        gain.gain.linearRampToValueAtTime(0, t + dur);
        gain.connect(ctx.destination);

        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(480, t);
        osc.connect(gain);

        osc.start(t);
        osc.stop(t + dur);
      });
    } catch (e) {
      console.warn("Busy sound error:", e);
    }
  }

  // STOP ALL PLAYING SOUNDS
  stopAllSounds() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.activeNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
  }
}

export const callSounds = new CallSoundManager();
