import { useEffect, useRef, useState } from 'react';
import type { AdContext } from '../ads.js';
import type { AdCreative } from '../config.js';

function openClickThrough(ad: AdCreative): void {
  if (ad.clickUrl) window.open(ad.clickUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Full-screen ad used for prerolls (before playback) and interstitials
 * (before a detail sheet). Images and messages auto-advance after their
 * duration; videos end naturally with a safety timeout. The skip button
 * appears once `skipAfterSec` elapses.
 */
export function AdOverlay({
  ad,
  onDone,
}: {
  ad: AdCreative;
  onDone: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const secs = (Date.now() - started) / 1000;
      setElapsed(secs);
      if (ad.type !== 'video' && secs >= ad.durationSec) {
        window.clearInterval(timer);
        doneRef.current();
      }
    }, 200);
    // Safety net so a stalled ad video can never trap the viewer.
    const safety = window.setTimeout(
      () => doneRef.current(),
      (ad.durationSec + 3) * 1000,
    );
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(safety);
    };
  }, [ad]);

  const canSkip = elapsed >= ad.skipAfterSec;
  const remaining = Math.max(0, Math.ceil(ad.durationSec - elapsed));

  return (
    <div className="ad-overlay" role="dialog" aria-label={ad.label}>
      <div className="ad-overlay-box" onClick={() => openClickThrough(ad)}>
        <span className="ad-chip">{ad.label}</span>
        {ad.type === 'video' && ad.mediaUrl ? (
          <video
            className="ad-video"
            src={ad.mediaUrl}
            autoPlay
            muted
            playsInline
            onEnded={onDone}
          />
        ) : null}
        {ad.type === 'image' && ad.mediaUrl ? (
          <img className="ad-image" src={ad.mediaUrl} alt={ad.title} />
        ) : null}
        {ad.type === 'message' ? (
          <div className="ad-message">
            {ad.title ? <h3>{ad.title}</h3> : null}
            {ad.text ? <p>{ad.text}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="ad-overlay-actions">
        {ad.clickUrl ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={(event) => {
              event.stopPropagation();
              openClickThrough(ad);
            }}
          >
            Más información
          </button>
        ) : null}
        <button
          type="button"
          className="btn"
          disabled={!canSkip}
          onClick={onDone}
        >
          {canSkip ? 'Saltar anuncio' : `Saltar en ${remaining}s`}
        </button>
      </div>
    </div>
  );
}

/**
 * In-page banner slot. The ad is picked once per mount through the shared
 * engine callback (which applies targeting, caps, and impression logging);
 * when nothing is eligible the slot renders nothing and the layout closes up.
 */
export function BannerAd({
  pickAdFor,
  context,
}: {
  pickAdFor: (context: AdContext) => AdCreative | null;
  context: Omit<AdContext, 'placement' | 'now'>;
}) {
  const [ad, setAd] = useState<AdCreative | null>(null);
  const [closed, setClosed] = useState(false);
  const pickedRef = useRef(false);

  useEffect(() => {
    if (pickedRef.current) return;
    pickedRef.current = true;
    setAd(pickAdFor({ ...context, placement: 'banner', now: new Date() }));
    // `context` changes identity on every render; the pick must run once per
    // mount, which is exactly what an empty dependency list expresses here.
  }, []);

  if (!ad || closed) return null;

  return (
    <div className="banner-ad" role="complementary" aria-label={ad.label}>
      <div className="banner-ad-content" onClick={() => openClickThrough(ad)}>
        <span className="ad-chip">{ad.label}</span>
        {ad.type === 'image' && ad.mediaUrl ? (
          <img src={ad.mediaUrl} alt={ad.title} loading="lazy" />
        ) : (
          <div className="ad-message banner-message">
            {ad.title ? <h3>{ad.title}</h3> : null}
            {ad.text ? <p>{ad.text}</p> : null}
          </div>
        )}
      </div>
      <button
        type="button"
        className="banner-ad-close"
        aria-label="Cerrar anuncio"
        onClick={() => setClosed(true)}
      >
        ×
      </button>
    </div>
  );
}
