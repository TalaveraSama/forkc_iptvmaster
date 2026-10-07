import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../App.js';
import type { AdContext } from '../ads.js';
import type { AdCreative } from '../config.js';
import type { PlayerSession, ProgressEntry } from '../storage.js';
import { playbackUrl } from '../xtream.js';
import { AdOverlay } from './AdSlot.js';

interface WatchProps {
  session: PlayerSession;
  mediaType: 'live' | 'vod' | 'series';
  streamRef: string;
  title: string;
  poster: string;
  progress: ProgressEntry[];
  pickAdFor: (context: AdContext) => AdCreative | null;
  onProgress: (entry: ProgressEntry) => void;
}

type Phase = 'ad' | 'main' | 'error';

export function Watch({
  session,
  mediaType,
  streamRef,
  title,
  poster,
  progress,
  pickAdFor,
  onProgress,
}: WatchProps) {
  const url = useMemo(
    () => playbackUrl(session, mediaType, streamRef),
    [session, mediaType, streamRef],
  );
  const key = `${mediaType}:${streamRef}`;
  const resumeEntry = progress.find((entry) => entry.key === key);

  // `null` means the preroll decision is done and there is no ad. The phase
  // starts as 'ad' (decision pending) so the main video never autoplays a
  // frame before the preroll resolves; for live streams no ad is picked and
  // the phase flips to 'main' immediately.
  const [preroll, setPreroll] = useState<AdCreative | null | undefined>(
    undefined,
  );
  const [phase, setPhase] = useState<Phase>('ad');
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedAt = useRef(0);
  const resumed = useRef(false);

  useEffect(() => {
    if (mediaType === 'live') {
      setPreroll(null);
      return;
    }
    const ad = pickAdFor({
      placement: 'preroll',
      mediaType,
      title,
      now: new Date(),
    });
    setPreroll(ad);
    // One decision per mounted stream; `title` only feeds ad targeting.
  }, [mediaType, pickAdFor, title]);

  useEffect(() => {
    if (preroll === undefined) return;
    if (preroll !== null) setPhase('ad');
    else setPhase('main');
  }, [preroll]);

  // Attach hls.js only when the URL is HLS and the browser lacks native
  // support. Everything else plays through the plain <video> element; TS and
  // MKV streams (common on IPTV) surface the external-player fallback.
  const nativeHls = useMemo(
    () =>
      document
        .createElement('video')
        .canPlayType('application/vnd.apple.mpegurl') !== '',
    [],
  );
  const needsHls = useMemo(
    () => /\.m3u8($|\?)/i.test(url) && !nativeHls,
    [url, nativeHls],
  );

  useEffect(() => {
    if (phase !== 'main' || !needsHls) return;
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;
    void import('hls.js')
      .then(({ default: Hls }) => {
        if (destroyed) return;
        if (!Hls.isSupported()) {
          setPhase('error');
          return;
        }
        const instance = new Hls();
        hls = instance;
        instance.loadSource(url);
        instance.attachMedia(video);
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal && !destroyed) setPhase('error');
        });
      })
      .catch(() => {
        if (!destroyed) setPhase('error');
      });
    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [phase, url, needsHls]);

  const saveProgress = () => {
    const video = videoRef.current;
    if (!video || mediaType === 'live' || !Number.isFinite(video.duration)) {
      return;
    }
    const now = Date.now();
    if (now - lastSavedAt.current < 5_000) return;
    lastSavedAt.current = now;
    onProgress({
      key,
      mediaType,
      streamRef,
      title,
      poster,
      positionSec: Math.floor(video.currentTime),
      durationSec: Math.floor(video.duration),
      updatedAt: now,
    });
  };

  const clearProgress = () => {
    if (mediaType === 'live') return;
    onProgress({
      key,
      mediaType,
      streamRef,
      title,
      poster,
      positionSec: 0,
      durationSec: 0,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="watch">
      <div className="watch-topbar">
        <button
          type="button"
          className="btn btn-ghost watch-back"
          onClick={() => {
            if (window.history.length > 1) window.history.back();
            else navigate('#/');
          }}
        >
          ← Volver
        </button>
        <span className="watch-title">{title}</span>
      </div>

      {phase === 'ad' && preroll ? (
        <AdOverlay ad={preroll} onDone={() => setPhase('main')} />
      ) : null}

      {phase === 'error' ? (
        <div className="watch-fallback">
          {poster ? (
            <img src={poster} alt="" className="watch-fallback-poster" />
          ) : null}
          <h2>{title}</h2>
          <p>
            El navegador no puede reproducir este stream directamente. Es normal
            en formatos de IPTV como <code>.ts</code> o <code>.mkv</code>, y
            también cuando el proveedor bloquea la reproducción web (CORS).
          </p>
          <p>Ábrelo en tu reproductor favorito (VLC, MPV, TiviMate…):</p>
          <div className="watch-fallback-actions">
            <a
              className="btn btn-play"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Abrir en reproductor externo
            </a>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(url);
              }}
            >
              Copiar enlace
            </button>
          </div>
        </div>
      ) : null}

      <video
        ref={videoRef}
        className={`watch-video${phase === 'main' ? ' visible' : ''}`}
        src={phase === 'main' && !needsHls ? url : undefined}
        controls
        autoPlay
        playsInline
        poster={poster || undefined}
        onLoadedMetadata={() => {
          const video = videoRef.current;
          if (!video || resumed.current) return;
          resumed.current = true;
          if (
            resumeEntry &&
            resumeEntry.positionSec > 30 &&
            Number.isFinite(video.duration) &&
            resumeEntry.positionSec < video.duration - 60
          ) {
            video.currentTime = resumeEntry.positionSec;
          }
        }}
        onTimeUpdate={saveProgress}
        onEnded={clearProgress}
        onError={() => {
          if (phase === 'main') setPhase('error');
        }}
      />
    </div>
  );
}
