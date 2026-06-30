import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// FUTURE ACTION SLOT: app.use("/api/hardware", hardwareRouter)
// FUTURE ACTION SLOT: app.use("/api/ai", aiRouter)
// FUTURE ACTION SLOT: app.use("/api/boss", bossRouter)

export default app;

// ── Overlay HTML (OBS Browser Source) ────────────────────────────────────────
const OVERLAY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Twitch Bot Overlay</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: transparent;
      font-family: 'Segoe UI', sans-serif;
      overflow: hidden;
      width: 1920px;
      height: 1080px;
    }
    #notif {
      position: fixed;
      bottom: 48px;
      left: 50%;
      transform: translateX(-50%) translateY(120%);
      background: rgba(14,14,16,0.92);
      border: 1px solid rgba(145,70,255,0.6);
      border-radius: 14px;
      padding: 14px 28px;
      display: flex;
      align-items: center;
      gap: 14px;
      color: #efeff1;
      font-size: 22px;
      font-weight: 600;
      backdrop-filter: blur(12px);
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s;
      opacity: 0;
      white-space: nowrap;
      box-shadow: 0 8px 40px rgba(145,70,255,0.3);
    }
    #notif.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    .notif-icon { font-size: 28px; }
    #status {
      position: fixed;
      top: 12px;
      right: 16px;
      font-size: 12px;
      color: rgba(255,255,255,0.25);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: #777;
    }
    .dot.live { background: #00c96f; box-shadow: 0 0 6px #00c96f; }
  </style>
</head>
<body>
  <div id="status"><div class="dot" id="dot"></div><span id="statusTxt">Connecting…</span></div>
  <div id="notif"><span class="notif-icon" id="notifIcon">🔊</span><span id="notifTxt">Ready</span></div>

  <script>
    const SOUNDS = {
      sound_airhorn:    { label: 'AIRHORN!',       icon: '📯', fn: playAirhorn },
      sound_sad_violin: { label: 'Sad Violin',      icon: '🎻', fn: playSadViolin },
      sound_drumroll:   { label: 'Drum Roll…',      icon: '🥁', fn: playDrumRoll },
      sound_victory:    { label: 'VICTORY!',        icon: '🏆', fn: playVictory },
      sound_fail:       { label: 'FAIL!',           icon: '💀', fn: playFail },
      sound_ding:       { label: 'Ding!',           icon: '🔔', fn: playDing },
    };

    let audioCtx = null;

    function getCtx() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }

    function playAirhorn() {
      const ctx = getCtx(), t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const dist = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = (i * 2) / 256 - 1; curve[i] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x)); }
      dist.curve = curve;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(466, t);
      osc.frequency.setValueAtTime(440, t + 0.05);
      osc.frequency.setValueAtTime(466, t + 0.1);
      osc.frequency.exponentialRampToValueAtTime(280, t + 0.6);
      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.65);
      osc.connect(dist); dist.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.7);
    }

    function playSadViolin() {
      const ctx = getCtx(), t = ctx.currentTime;
      [[440,0],[415,0.6],[392,1.2],[349,1.9],[294,2.6]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + delay);
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.35, t + delay + 0.08);
        gain.gain.setValueAtTime(0.35, t + delay + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.65);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t + delay); osc.stop(t + delay + 0.7);
      });
    }

    function playDrumRoll() {
      const ctx = getCtx(), t = ctx.currentTime;
      const bufLen = ctx.sampleRate * 0.025;
      for (let hit = 0; hit < 30; hit++) {
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        filter.type = 'bandpass';
        filter.frequency.value = 200 + hit * 15;
        filter.Q.value = 0.8;
        gain.gain.value = 0.4 + hit * 0.02;
        src.buffer = buf;
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        src.start(t + hit * 0.05);
      }
    }

    function playVictory() {
      const ctx = getCtx(), t = ctx.currentTime;
      [261.63, 329.63, 392.00, 523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = t + i * 0.18;
        gain.gain.setValueAtTime(0.5, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(start); osc.stop(start + 0.55);
      });
    }

    function playFail() {
      const ctx = getCtx(), t = ctx.currentTime;
      [466.16, 440.00, 415.30, 311.13].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const start = t + i * 0.28;
        gain.gain.setValueAtTime(0.45, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + (i === 3 ? 0.9 : 0.25));
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(start); osc.stop(start + (i === 3 ? 1 : 0.3));
      });
    }

    function playDing() {
      const ctx = getCtx(), t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1046.5;
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.85);
    }

    // ── Notification ────────────────────────────────────────────────────────
    let hideTimer = null;
    function showNotif(icon, label) {
      const el = document.getElementById('notif');
      document.getElementById('notifIcon').textContent = icon;
      document.getElementById('notifTxt').textContent = label;
      el.classList.add('show');
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => el.classList.remove('show'), 3000);
    }

    // ── SSE Connection ───────────────────────────────────────────────────────
    const dot = document.getElementById('dot');
    const statusTxt = document.getElementById('statusTxt');

    function connect() {
      const base = window.location.origin;
      const es = new EventSource(base + '/api/sounds/stream');

      es.onopen = () => {
        dot.className = 'dot live';
        statusTxt.textContent = 'Connected';
      };

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'play' && msg.soundId && SOUNDS[msg.soundId]) {
            const s = SOUNDS[msg.soundId];
            s.fn();
            showNotif(s.icon, s.label);
          }
        } catch {}
      };

      es.onerror = () => {
        dot.className = 'dot';
        statusTxt.textContent = 'Reconnecting…';
        es.close();
        setTimeout(connect, 3000);
      };
    }

    // Autoconnect — OBS browser source initializes with user gesture handled by OBS
    document.addEventListener('click', () => getCtx(), { once: true });
    connect();
  </script>
</body>
</html>`;
