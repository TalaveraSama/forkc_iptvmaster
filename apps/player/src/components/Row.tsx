import { useRef } from 'react';
import type { CatalogItem } from '../catalogue.js';

export function Poster({ item }: { item: CatalogItem }) {
  return item.poster ? (
    <img
      className="card-poster"
      src={item.poster}
      alt=""
      loading="lazy"
      onError={(event) => {
        event.currentTarget.classList.add('missing');
      }}
    />
  ) : (
    <div className="card-poster missing" aria-hidden="true">
      <span>{item.title.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

export function Card({
  item,
  wide,
  progressRatio,
  onClick,
}: {
  item: CatalogItem;
  wide?: boolean;
  progressRatio?: number;
  onClick: (item: CatalogItem) => void;
}) {
  return (
    <button
      type="button"
      className={`card${wide ? ' card-wide' : ''}`}
      onClick={() => onClick(item)}
      title={item.title}
    >
      <div className="card-media">
        <Poster item={item} />
        {item.mediaType === 'live' ? (
          <span className="card-live-badge">EN VIVO</span>
        ) : null}
        {progressRatio !== undefined && progressRatio > 0 ? (
          <span className="card-progress">
            <span
              className="card-progress-fill"
              style={{ width: `${Math.min(100, progressRatio * 100)}%` }}
            />
          </span>
        ) : null}
      </div>
      <span className="card-title">{item.title}</span>
    </button>
  );
}

export function Row({
  title,
  items,
  wide,
  progressByKey,
  onItemClick,
}: {
  title: string;
  items: CatalogItem[];
  wide?: boolean;
  progressByKey?: Map<string, number>;
  onItemClick: (item: CatalogItem) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const scrollBy = (direction: number) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({
      left: direction * node.clientWidth * 0.9,
      behavior: 'smooth',
    });
  };

  return (
    <section className="row">
      <div className="row-header">
        <h2 className="row-title">{title}</h2>
        <div className="row-nav">
          <button
            type="button"
            className="row-arrow"
            aria-label={`Retroceder en ${title}`}
            onClick={() => scrollBy(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="row-arrow"
            aria-label={`Avanzar en ${title}`}
            onClick={() => scrollBy(1)}
          >
            ›
          </button>
        </div>
      </div>
      <div className="row-scroller" ref={scroller}>
        {items.map((item) => (
          <Card
            key={item.key}
            item={item}
            wide={wide}
            progressRatio={progressByKey?.get(item.key)}
            onClick={onItemClick}
          />
        ))}
      </div>
    </section>
  );
}
