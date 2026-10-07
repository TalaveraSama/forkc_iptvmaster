import { useMemo, useState } from 'react';
import type { DetailTarget } from '../App.js';
import { navigate, watchRoute } from '../App.js';
import type { CatalogItem } from '../catalogue.js';
import { buildAllItems } from '../catalogue.js';
import type { Catalogue } from '../xtream.js';
import { Card } from './Row.js';

const RESULT_LIMIT = 60;

export function SearchView({
  catalogue,
  onOpenDetail,
}: {
  catalogue: Catalogue;
  onOpenDetail: (target: DetailTarget) => void;
}) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => buildAllItems(catalogue), [catalogue]);

  const normalized = query.trim().toLowerCase();
  const matches = (items: CatalogItem[]) =>
    normalized
      ? items
          .filter((item) => item.title.toLowerCase().includes(normalized))
          .slice(0, RESULT_LIMIT)
      : [];

  const movies = matches(all.movies);
  const shows = matches(all.shows);
  const live = matches(all.live);
  const total = movies.length + shows.length + live.length;

  const open = (item: CatalogItem) => {
    if (item.mediaType === 'live') {
      navigate(watchRoute('live', item.streamRef, item.title, item.poster));
      return;
    }
    onOpenDetail({
      mediaType: item.mediaType,
      id: item.id,
      title: item.title,
      poster: item.poster,
      categoryName: item.categoryName,
    });
  };

  const section = (title: string, items: CatalogItem[], wide?: boolean) =>
    items.length > 0 ? (
      <section className="search-section">
        <h2>{title}</h2>
        <div className="poster-grid">
          {items.map((item) => (
            <Card key={item.key} item={item} wide={wide} onClick={open} />
          ))}
        </div>
      </section>
    ) : null;

  return (
    <div className="search">
      <input
        className="search-input"
        type="search"
        autoFocus
        placeholder="Buscar películas, series y canales…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {normalized && total === 0 ? (
        <p className="empty-text">Sin resultados para «{query.trim()}».</p>
      ) : null}
      {section('Películas', movies)}
      {section('Series', shows)}
      {section('Canales en vivo', live, true)}
    </div>
  );
}
