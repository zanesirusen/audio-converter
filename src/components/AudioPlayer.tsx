import { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps { src: string; }

export function AudioPlayer({ src }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Init Web Audio API on first play
  function initAudio() {
    if (ctxRef.current || !audioRef.current) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const source = ctx.createMediaElementSource(audioRef.current);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    ctxRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;
  }

  function drawWave() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const bufLen = analyser.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(dataArr);

    const W = canvas.width;
    const H = canvas.height;
    ctx2d.clearRect(0, 0, W, H);

    const barW = (W / bufLen) * 2.5;
    let x = 0;
    for (let i = 0; i < bufLen; i++) {
      const barH = (dataArr[i] / 255) * H;
      const hue = 210 + (dataArr[i] / 255) * 80;
      ctx2d.fillStyle = `hsla(${hue}, 80%, 65%, 0.85)`;
      ctx2d.fillRect(x, H - barH, barW, barH);
      x += barW + 1;
    }
    animFrameRef.current = requestAnimationFrame(drawWave);
  }

  function drawIdle() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx2d.clearRect(0, 0, W, H);
    // Draw a static placeholder waveform
    const bars = 40;
    const barW = W / (bars * 2);
    for (let i = 0; i < bars; i++) {
      const barH = 4 + Math.abs(Math.sin(i * 0.5)) * (H * 0.55);
      ctx2d.fillStyle = 'rgba(93,141,255,0.25)';
      ctx2d.fillRect(i * (barW * 2) + barW / 2, H / 2 - barH / 2, barW, barH);
    }
  }

  useEffect(() => {
    drawIdle();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [src]);

  function handlePlay() {
    initAudio();
    if (ctxRef.current?.state === 'suspended') void ctxRef.current.resume();
    setPlaying(true);
    cancelAnimationFrame(animFrameRef.current);
    drawWave();
  }

  function handlePause() {
    setPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
    drawIdle();
  }

  function handleEnded() {
    setPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
    drawIdle();
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); }
    else { void audioRef.current.play(); }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
  }

  function handleVolume(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    setMuted(v === 0);
  }

  function toggleMute() {
    if (!audioRef.current) return;
    const next = !muted;
    setMuted(next);
    audioRef.current.muted = next;
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  return (
    <div className="custom-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />
      <canvas ref={canvasRef} className="player-waveform" width={320} height={48} />
      <div className="player-controls">
        <button className="player-btn play-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '⏸' : '▶'}
        </button>
        <div className="player-seek-group">
          <span className="player-time">{fmt(currentTime)}</span>
          <input
            className="player-seek"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Seek"
          />
          <span className="player-time">{fmt(duration)}</span>
        </div>
        <button className="player-btn mute-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted || volume === 0 ? '🔇' : '🔊'}
        </button>
        <input
          className="player-vol"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={handleVolume}
          aria-label="Volume"
        />
      </div>
    </div>
  );
}
