import { useMemo } from 'react';
import type { DetailTarget } from '../App.js';
import type { BrandingConfig } from '../config.js';
import type { CatalogItem } from '../catalogue.js';

const hasArtwork = (item: CatalogItem) => Boolean(item.backdrop || item.poster);

function pickFeatured(
  heroSource: BrandingConfig['heroSource'],
  movies: CatalogItem[],
  shows: CatalogItem[],
): CatalogItem | null {
  const films = movies.filter(hasArtwork);
  const series = shows.filter(hasArtwork);

  let candidates: CatalogItem[];
  if (heroSource === 'movies') {
    candidates = films;
  } else if (heroSource === 'series') {
    candidates = [...series, ...films];
  } else {
    // Interleave so the daily rotation alternates films and series.
    candidates = [];
    const max = Math.max(series.length, films.length);
    for (let index = 0; index < max; index += 1) {
      const show = series[index];
      const film = films[index];
      if (show) candidates.push(show);
      if (film) candidates.push(film);
    }
  }
  if (candidates.length === 0) return null;

  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  return candidates[dayOfYear % candidates.length] ?? null;
}

export function Hero({
  branding,
  movies,
  shows,
  onOpenDetail,
  onPlayMovie,
}: {
  branding: BrandingConfig;
  movies: CatalogItem[];
  shows: CatalogItem[];
  onOpenDetail: (target: DetailTarget) => void;
  onPlayMovie: (item: CatalogItem) => void;
}) {
  const featured = useMemo(
    () => pickFeatured(branding.heroSource, movies, shows),
    [branding.heroSource, movies, shows],
  );

  if (!featured) {
    return (
      <header className="hero hero-fallback">
        <div className="hero-content">
          <h1 className="hero-title">{branding.appName}</h1>
          <p className="hero-tagline">{branding.tagline}</p>
        </div>
      </header>
    );
  }

  const target: DetailTarget = {
    mediaType: featured.mediaType === 'series' ? 'series' : 'vod',
    id: featured.id,
    title: featured.title,
    poster: featured.poster,
    categoryName: featured.categoryName,
  };
  const artwork = featured.backdrop || featured.poster;

  return (
    <header
      className="hero"
      style={artwork ? { backgroundImage: `url(${artwork})` } : undefined}
    >
      <div className="hero-content">
        <p className="hero-kind">
          {featured.mediaType === 'series' ? 'Serie' : 'Película'}
        </p>
        <h1 className="hero-title">{featured.title}</h1>
        <div className="hero-meta">
          {featured.rating ? (
            <span className="hero-rating">★ {featured.rating}</span>
          ) : null}
          {featured.year ? <span>{featured.year}</span> : null}
          <span>{featured.categoryName}</span>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-play"
            onClick={() =>
              featured.mediaType === 'series'
                ? onOpenDetail(target)
                : onPlayMovie(featured)
            }
          >
            ▶ Reproducir
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onOpenDetail(target)}
          >
            Más información
          </button>
        </div>
      </div>
    </header>
  );
}
