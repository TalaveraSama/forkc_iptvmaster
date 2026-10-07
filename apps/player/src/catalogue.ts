/**
 * Shared helpers that turn raw Xtream catalogue payloads into the uniform
 * item shape every grid, row, and search result renders.
 */

import type {
  Catalogue,
  XtreamCategory,
  XtreamSeriesSummary,
  XtreamStream,
} from './xtream.js';

export interface CatalogItem {
  key: string;
  mediaType: 'live' | 'vod' | 'series';
  id: number;
  title: string;
  poster: string;
  categoryName: string;
  rating: string;
  year: string;
  /** Wide artwork for hero/backdrop use; falls back to the poster. */
  backdrop: string;
  /** Playback file reference, e.g. `1234.mp4` (live and favorites). */
  streamRef: string;
}

export function categoryNameOf(
  categories: XtreamCategory[],
  categoryId: string,
): string {
  const match = categories.find(
    (category) => category.category_id === categoryId,
  );
  return match?.category_name ?? 'Sin categoría';
}

export function yearOf(releaseDate: string): string {
  const match = releaseDate.match(/(19|20)\d{2}/);
  return match ? match[0] : '';
}

function ratingOf(rating: string, rating5: number | undefined): string {
  if (rating && rating !== '0') return rating;
  if (rating5) return String(rating5);
  return '';
}

export function movieItems(
  streams: XtreamStream[],
  categories: XtreamCategory[],
): CatalogItem[] {
  return streams.map((stream) => ({
    key: `vod:${stream.stream_id}`,
    mediaType: 'vod' as const,
    id: stream.stream_id,
    title: stream.name,
    poster: stream.stream_icon,
    categoryName: categoryNameOf(categories, stream.category_id),
    rating: ratingOf(stream.rating ?? '', stream.rating_5based),
    year: '',
    backdrop: '',
    streamRef: `${stream.stream_id}.${stream.container_extension || 'mp4'}`,
  }));
}

export function seriesItems(
  series: XtreamSeriesSummary[],
  categories: XtreamCategory[],
): CatalogItem[] {
  return series.map((show) => ({
    key: `series:${show.series_id}`,
    mediaType: 'series' as const,
    id: show.series_id,
    title: show.name,
    poster: show.cover,
    categoryName: categoryNameOf(categories, show.category_id),
    rating: ratingOf(show.rating, show.rating_5based),
    year: yearOf(show.releaseDate),
    backdrop: show.backdrop_path[0] ?? '',
    streamRef: '',
  }));
}

export function liveItems(
  streams: XtreamStream[],
  categories: XtreamCategory[],
): CatalogItem[] {
  return streams.map((stream) => ({
    key: `live:${stream.stream_id}`,
    mediaType: 'live' as const,
    id: stream.stream_id,
    title: stream.name,
    poster: stream.stream_icon,
    categoryName: categoryNameOf(categories, stream.category_id),
    rating: '',
    year: '',
    backdrop: '',
    streamRef: `${stream.stream_id}.${stream.container_extension || 'ts'}`,
  }));
}

export function groupByCategory<T extends { categoryName: string }>(
  items: T[],
  categories: XtreamCategory[],
): Array<{ categoryId: string; categoryName: string; items: T[] }> {
  const order: string[] = [];
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const name = item.categoryName;
    const existing = buckets.get(name);
    if (existing) existing.push(item);
    else {
      buckets.set(name, [item]);
      order.push(name);
    }
  }
  // Follow the provider category order where known; extras go last.
  const byName = new Map(
    categories.map((category) => [
      category.category_name,
      category.category_id,
    ]),
  );
  return order.map((name) => ({
    categoryId: byName.get(name) ?? name,
    categoryName: name,
    items: buckets.get(name) ?? [],
  }));
}

export function buildAllItems(catalogue: Catalogue): {
  movies: CatalogItem[];
  shows: CatalogItem[];
  live: CatalogItem[];
} {
  return {
    movies: movieItems(catalogue.vodStreams, catalogue.vodCategories),
    shows: seriesItems(catalogue.series, catalogue.seriesCategories),
    live: liveItems(catalogue.liveStreams, catalogue.liveCategories),
  };
}

export const ROW_ITEM_LIMIT = 40;
