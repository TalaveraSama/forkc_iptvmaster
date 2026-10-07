import { useEffect, useMemo, useState } from 'react';
import type { DetailTarget } from '../App.js';
import { navigate, watchRoute } from '../App.js';
import type { FavoriteEntry } from '../storage.js';
import type { PlayerSession } from '../storage.js';
import type {
  Catalogue,
  XtreamSeriesDetail,
  XtreamVodInfo,
} from '../xtream.js';
import { getSeriesInfo, getVodInfo } from '../xtream.js';

interface DetailModalProps {
  session: PlayerSession;
  catalogue: Catalogue;
  target: DetailTarget;
  favorites: FavoriteEntry[];
  onToggleFavorite: (entry: FavoriteEntry) => void;
  onClose: () => void;
}

function textField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function seasonNumber(key: string): number {
  const parsed = Number(key);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function DetailModal({
  session,
  catalogue,
  target,
  favorites,
  onToggleFavorite,
  onClose,
}: DetailModalProps) {
  const [vodInfo, setVodInfo] = useState<XtreamVodInfo | null>(null);
  const [seriesInfo, setSeriesInfo] = useState<XtreamSeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeSeason, setActiveSeason] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    void (async () => {
      try {
        if (target.mediaType === 'vod') {
          const info = await getVodInfo(session, target.id);
          if (!cancelled) setVodInfo(info);
        } else {
          const info = await getSeriesInfo(session, target.id);
          if (!cancelled) setSeriesInfo(info);
        }
      } catch {
        if (!cancelled) {
          setLoadError('No se pudo cargar el detalle desde el servidor.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, target]);

  const favoriteKey = `${target.mediaType}:${target.id}`;
  const isFavorite = favorites.some((entry) => entry.key === favoriteKey);

  const seasons = useMemo(() => {
    if (!seriesInfo) return [];
    return Object.keys(seriesInfo.episodes).sort(
      (a, b) => seasonNumber(a) - seasonNumber(b),
    );
  }, [seriesInfo]);

  useEffect(() => {
    if (seasons.length > 0 && !seasons.includes(activeSeason)) {
      setActiveSeason(seasons[0] ?? '');
    }
  }, [seasons, activeSeason]);

  const stream = catalogue.vodStreams.find(
    (candidate) => candidate.stream_id === target.id,
  );
  const summary = catalogue.series.find(
    (candidate) => candidate.series_id === target.id,
  );

  const info = vodInfo?.info ?? {};
  const plot =
    textField(info['plot']) ||
    textField(info['description']) ||
    summary?.plot ||
    '';
  const genre = textField(info['genre']) || summary?.genre || '';
  const director = textField(info['director']) || summary?.director || '';
  const cast =
    textField(info['cast']) || textField(info['actors']) || summary?.cast || '';
  const releaseDate =
    textField(info['releasedate']) || summary?.releaseDate || '';
  const rating =
    textField(info['rating']) ||
    (summary && summary.rating_5based ? String(summary.rating_5based) : '');
  const backdrops = Array.isArray(info['backdrop_path'])
    ? (info['backdrop_path'] as unknown[]).filter(
        (entry): entry is string => typeof entry === 'string' && entry !== '',
      )
    : [];
  const backdrop =
    backdrops[0] || summary?.backdrop_path[0] || textField(info['cover_big']);
  const poster =
    textField(info['cover_big']) ||
    textField(info['movie_image']) ||
    summary?.cover ||
    target.poster;
  const year = (releaseDate.match(/(19|20)\d{2}/) ?? [''])[0];

  const playMovie = () => {
    const movieData = vodInfo?.movie_data;
    const streamId = movieData?.stream_id || target.id;
    const extension =
      movieData?.container_extension || stream?.container_extension || 'mp4';
    navigate(
      watchRoute('vod', `${streamId}.${extension}`, target.title, poster),
    );
  };

  const episodes = activeSeason
    ? (seriesInfo?.episodes[activeSeason] ?? [])
    : [];

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-label={target.title}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          aria-label="Cerrar"
          onClick={onClose}
        >
          ×
        </button>
        <div
          className="modal-hero"
          style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}
        >
          <div className="modal-hero-content">
            <h2 className="modal-title">{target.title}</h2>
            <div className="modal-actions">
              {target.mediaType === 'vod' ? (
                <button
                  type="button"
                  className="btn btn-play"
                  onClick={playMovie}
                  disabled={loading}
                >
                  ▶ Reproducir
                </button>
              ) : null}
              <button
                type="button"
                className={`btn btn-ghost btn-favorite${isFavorite ? ' favorited' : ''}`}
                aria-pressed={isFavorite}
                onClick={() =>
                  onToggleFavorite({
                    key: favoriteKey,
                    mediaType: target.mediaType,
                    id: target.id,
                    title: target.title,
                    poster,
                    addedAt: Date.now(),
                  })
                }
              >
                {isFavorite ? '✓ En Mi lista' : '+ Mi lista'}
              </button>
            </div>
          </div>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">
              <div className="splash-spinner" aria-label="Cargando detalle" />
            </div>
          ) : null}
          {loadError ? <p className="error-text">{loadError}</p> : null}
          <div className="modal-meta">
            {rating && rating !== '0' ? (
              <span className="hero-rating">★ {rating}</span>
            ) : null}
            {year ? <span>{year}</span> : null}
            <span>{target.categoryName}</span>
            {genre ? <span>{genre}</span> : null}
            {director ? <span>Dir. {director}</span> : null}
          </div>
          {plot ? (
            <p className="modal-plot">{plot}</p>
          ) : (
            !loading && (
              <p className="modal-plot muted">
                Sin descripción disponible para este título.
              </p>
            )
          )}
          {cast ? <p className="modal-cast">Reparto: {cast}</p> : null}

          {target.mediaType === 'series' ? (
            <div className="episodes">
              {seasons.length > 1 ? (
                <div className="season-tabs" role="tablist">
                  {seasons.map((season) => (
                    <button
                      key={season}
                      type="button"
                      role="tab"
                      aria-selected={season === activeSeason}
                      className={`season-tab${season === activeSeason ? ' active' : ''}`}
                      onClick={() => setActiveSeason(season)}
                    >
                      Temporada {seasonNumber(season) || season}
                    </button>
                  ))}
                </div>
              ) : null}
              {episodes.map((episode) => {
                const still = episode.info.movie_image || poster;
                const episodeTitle =
                  episode.title || `Episodio ${episode.episode_num}`;
                return (
                  <button
                    key={episode.id}
                    type="button"
                    className="episode"
                    onClick={() =>
                      navigate(
                        watchRoute(
                          'series',
                          `${episode.id}.${episode.container_extension || 'mp4'}`,
                          `${target.title} · ${episodeTitle}`,
                          still,
                        ),
                      )
                    }
                  >
                    <span className="episode-number">
                      {episode.episode_num}
                    </span>
                    <span className="episode-still">
                      {still ? <img src={still} alt="" loading="lazy" /> : null}
                    </span>
                    <span className="episode-info">
                      <span className="episode-title-row">
                        <span className="episode-title">{episodeTitle}</span>
                        {episode.info.duration ? (
                          <span className="episode-duration">
                            {episode.info.duration}
                          </span>
                        ) : null}
                      </span>
                      {episode.info.plot ? (
                        <span className="episode-plot">
                          {episode.info.plot}
                        </span>
                      ) : null}
                    </span>
                    <span className="episode-play" aria-hidden="true">
                      ▶
                    </span>
                  </button>
                );
              })}
              {!loading && episodes.length === 0 ? (
                <p className="empty-text">
                  Esta serie aún no tiene episodios publicados.
                </p>
              ) : null}
            </div>
          ) : null}

          {target.mediaType === 'vod' && !loading && !stream && !vodInfo ? (
            <p className="empty-text">
              Este título ya no está disponible en el perfil de salida.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
