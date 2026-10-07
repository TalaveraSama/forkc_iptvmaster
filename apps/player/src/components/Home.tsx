import { useMemo } from 'react';
import type { BrowseSection, DetailTarget } from '../App.js';
import { navigate, watchRoute } from '../App.js';
import type { AdContext } from '../ads.js';
import type { AdCreative, BrandingConfig } from '../config.js';
import type { CatalogItem } from '../catalogue.js';
import {
  ROW_ITEM_LIMIT,
  buildAllItems,
  groupByCategory,
} from '../catalogue.js';
import type { FavoriteEntry, ProgressEntry } from '../storage.js';
import type { Catalogue } from '../xtream.js';
import { BannerAd } from './AdSlot.js';
import { Hero } from './Hero.js';
import { Row } from './Row.js';

interface HomeProps {
  section: BrowseSection;
  branding: BrandingConfig;
  catalogue: Catalogue;
  favorites: FavoriteEntry[];
  progress: ProgressEntry[];
  pickAdFor: (context: AdContext) => AdCreative | null;
  onOpenDetail: (target: DetailTarget) => void;
  onToggleFavorite: (entry: FavoriteEntry) => void;
}

function itemClick(
  item: CatalogItem,
  onOpenDetail: (target: DetailTarget) => void,
): void {
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
}

export function Home({
  section,
  branding,
  catalogue,
  favorites,
  progress,
  pickAdFor,
  onOpenDetail,
}: HomeProps) {
  const all = useMemo(() => buildAllItems(catalogue), [catalogue]);
  const openItem = (item: CatalogItem) => itemClick(item, onOpenDetail);

  const movieRows = useMemo(
    () =>
      groupByCategory(all.movies, catalogue.vodCategories).map((group) => ({
        ...group,
        items: group.items.slice(0, ROW_ITEM_LIMIT),
      })),
    [all.movies, catalogue.vodCategories],
  );
  const seriesRows = useMemo(
    () =>
      groupByCategory(all.shows, catalogue.seriesCategories).map((group) => ({
        ...group,
        items: group.items.slice(0, ROW_ITEM_LIMIT),
      })),
    [all.shows, catalogue.seriesCategories],
  );
  const liveRows = useMemo(
    () =>
      groupByCategory(all.live, catalogue.liveCategories).map((group) => ({
        ...group,
        items: group.items.slice(0, ROW_ITEM_LIMIT),
      })),
    [all.live, catalogue.liveCategories],
  );

  const continueItems: CatalogItem[] = useMemo(
    () =>
      progress.map((entry) => ({
        key: entry.key,
        mediaType: entry.mediaType,
        id: 0,
        title: entry.title,
        poster: entry.poster,
        categoryName: '',
        rating: '',
        year: '',
        backdrop: '',
        streamRef: entry.streamRef,
      })),
    [progress],
  );
  const progressByKey = useMemo(
    () =>
      new Map(
        progress.map((entry) => [
          entry.key,
          entry.durationSec > 0 ? entry.positionSec / entry.durationSec : 0,
        ]),
      ),
    [progress],
  );
  const favoriteItems: CatalogItem[] = useMemo(() => {
    const byKey = new Map([...all.movies, ...all.shows].map((i) => [i.key, i]));
    return favorites.flatMap((favorite) => {
      const live = byKey.get(favorite.key);
      if (live) return [live];
      return [
        {
          key: favorite.key,
          mediaType: favorite.mediaType,
          id: favorite.id,
          title: favorite.title,
          poster: favorite.poster,
          categoryName: '',
          rating: '',
          year: '',
          backdrop: '',
          streamRef: '',
        },
      ];
    });
  }, [favorites, all.movies, all.shows]);

  const clickContinue = (item: CatalogItem) => {
    const entry = progress.find((candidate) => candidate.key === item.key);
    if (!entry) return;
    navigate(
      watchRoute(entry.mediaType, entry.streamRef, entry.title, entry.poster),
    );
  };

  if (section !== 'home') {
    const rows =
      section === 'movies'
        ? movieRows
        : section === 'series'
          ? seriesRows
          : branding.showLiveSection
            ? liveRows
            : [];
    const title =
      section === 'movies'
        ? 'Películas'
        : section === 'series'
          ? 'Series'
          : 'En vivo';
    return (
      <div className="browse">
        <h1 className="browse-title">{title}</h1>
        {rows.length === 0 ? (
          <p className="empty-text">
            No hay contenido publicado en esta sección todavía.
          </p>
        ) : null}
        {rows.map((row) => (
          <Row
            key={row.categoryId + row.categoryName}
            title={row.categoryName}
            items={row.items}
            wide={section === 'live'}
            onItemClick={openItem}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="browse">
      <Hero
        branding={branding}
        movies={all.movies}
        shows={all.shows}
        onOpenDetail={onOpenDetail}
        onPlayMovie={(item) =>
          navigate(watchRoute('vod', item.streamRef, item.title, item.poster))
        }
      />
      <div className="home-rows">
        {continueItems.length > 0 ? (
          <Row
            title="Seguir viendo"
            items={continueItems}
            progressByKey={progressByKey}
            onItemClick={clickContinue}
          />
        ) : null}
        {favoriteItems.length > 0 ? (
          <Row title="Mi lista" items={favoriteItems} onItemClick={openItem} />
        ) : null}
        {seriesRows.slice(0, 6).map((row) => (
          <Row
            key={'s-' + row.categoryId + row.categoryName}
            title={row.categoryName}
            items={row.items}
            onItemClick={openItem}
          />
        ))}
        <BannerAd pickAdFor={pickAdFor} context={{}} />
        {movieRows.slice(0, 6).map((row) => (
          <Row
            key={'m-' + row.categoryId + row.categoryName}
            title={row.categoryName}
            items={row.items}
            onItemClick={openItem}
          />
        ))}
        {branding.showLiveSection
          ? liveRows
              .slice(0, 3)
              .map((row) => (
                <Row
                  key={'l-' + row.categoryId + row.categoryName}
                  title={row.categoryName}
                  items={row.items}
                  wide
                  onItemClick={openItem}
                />
              ))
          : null}
        {seriesRows.length === 0 &&
        movieRows.length === 0 &&
        liveRows.length === 0 ? (
          <p className="empty-text">
            Este perfil de salida aún no publica contenido. Activa categorías de
            películas o series en el panel de IPTVMaster.
          </p>
        ) : null}
      </div>
    </div>
  );
}
