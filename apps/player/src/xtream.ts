/**
 * Client for the Xtream-compatible API published by IPTVMaster output
 * profiles. The username is always `iptvmaster` and the password is the
 * output profile token, exactly like any other Xtream Codes player.
 *
 * Catalogue payloads are normalized defensively: a media type the profile
 * does not carry arrives as an empty list, and providers occasionally answer
 * `false` for sections an account cannot use.
 */

import type { PlayerSession } from './storage.js';

export const XTREAM_USERNAME = 'iptvmaster';

const REQUEST_TIMEOUT_MS = 30_000;

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamStream {
  num: number;
  name: string;
  stream_type: 'live' | 'movie';
  stream_id: number;
  stream_icon: string;
  added: string;
  category_id: string;
  container_extension?: string;
  rating?: string;
  rating_5based?: number;
  direct_source?: string;
}

export interface XtreamSeriesSummary {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  release_date?: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
}

export interface XtreamEpisode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  season: number;
  info: {
    plot: string;
    duration: string;
    duration_secs: number;
    movie_image: string;
    rating: number;
    season: number;
    releasedate: string;
  };
}

export interface XtreamSeriesDetail {
  seasons: Array<Record<string, unknown>>;
  info: Partial<
    Omit<XtreamSeriesSummary, 'num' | 'series_id' | 'category_ids'>
  > & {
    name?: string;
    cover?: string;
    category_id?: string;
  };
  episodes: Record<string, XtreamEpisode[]>;
}

export interface XtreamVodInfo {
  info: Record<string, unknown>;
  movie_data: {
    stream_id: number;
    name: string;
    container_extension?: string;
    category_id?: string;
  };
}

export interface Catalogue {
  vodCategories: XtreamCategory[];
  vodStreams: XtreamStream[];
  seriesCategories: XtreamCategory[];
  series: XtreamSeriesSummary[];
  liveCategories: XtreamCategory[];
  liveStreams: XtreamStream[];
}

export class XtreamRequestError extends Error {
  override readonly name = 'XtreamRequestError';
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function apiUrl(
  session: PlayerSession,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(
    '/player_api.php',
    trimTrailingSlash(session.serverUrl) || window.location.origin,
  );
  url.searchParams.set('username', XTREAM_USERNAME);
  url.searchParams.set('password', session.token);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

async function requestJson(
  session: PlayerSession,
  params: Record<string, string | undefined>,
): Promise<unknown> {
  const response = await fetch(apiUrl(session, params), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new XtreamRequestError(
      'El servidor respondió con un error',
      response.status,
    );
  }
  return (await response.json()) as unknown;
}

interface AuthResponse {
  user_info?: { auth?: number; status?: string };
}

export async function authenticate(
  session: PlayerSession,
): Promise<{ ok: boolean; message: string }> {
  try {
    const payload = (await requestJson(session, {})) as AuthResponse;
    if (payload?.user_info?.auth === 1) return { ok: true, message: '' };
    return {
      ok: false,
      message: 'El token no es válido o el perfil de salida está revocado.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof TypeError ||
        (error instanceof Error && error.name === 'TimeoutError')
          ? 'No se pudo contactar al servidor.'
          : 'El servidor respondió con un error.',
    };
  }
}

function asRecordArray(payload: unknown): Record<string, unknown>[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null,
  );
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return 0;
}

function normalizeCategories(payload: unknown): XtreamCategory[] {
  return asRecordArray(payload).map((record) => ({
    category_id: String(record['category_id'] ?? ''),
    category_name: stringField(record, 'category_name') || 'Sin categoría',
    parent_id: numberField(record, 'parent_id'),
  }));
}

function normalizeStreams(payload: unknown): XtreamStream[] {
  return asRecordArray(payload).flatMap((record) => {
    const streamId = numberField(record, 'stream_id');
    const name = stringField(record, 'name');
    if (!streamId || !name) return [];
    const stream: XtreamStream = {
      num: numberField(record, 'num'),
      name,
      stream_type: record['stream_type'] === 'live' ? 'live' : 'movie',
      stream_id: streamId,
      stream_icon: stringField(record, 'stream_icon'),
      added: stringField(record, 'added'),
      category_id: String(record['category_id'] ?? ''),
    };
    const extension = stringField(record, 'container_extension');
    if (extension) stream.container_extension = extension;
    const rating = stringField(record, 'rating');
    if (rating) stream.rating = rating;
    const rating5 = numberField(record, 'rating_5based');
    if (rating5) stream.rating_5based = rating5;
    return [stream];
  });
}

function normalizeSeries(payload: unknown): XtreamSeriesSummary[] {
  return asRecordArray(payload).flatMap((record) => {
    const seriesId = numberField(record, 'series_id');
    const name = stringField(record, 'name');
    if (!seriesId || !name) return [];
    const backdrops = Array.isArray(record['backdrop_path'])
      ? record['backdrop_path'].filter(
          (entry): entry is string => typeof entry === 'string' && entry !== '',
        )
      : [];
    return [
      {
        num: numberField(record, 'num'),
        name,
        series_id: seriesId,
        cover: stringField(record, 'cover'),
        plot: stringField(record, 'plot'),
        cast: stringField(record, 'cast'),
        director: stringField(record, 'director'),
        genre: stringField(record, 'genre'),
        releaseDate:
          stringField(record, 'releaseDate') ||
          stringField(record, 'release_date'),
        rating: stringField(record, 'rating'),
        rating_5based: numberField(record, 'rating_5based'),
        backdrop_path: backdrops,
        youtube_trailer: stringField(record, 'youtube_trailer'),
        episode_run_time: stringField(record, 'episode_run_time'),
        category_id: String(record['category_id'] ?? ''),
      },
    ];
  });
}

export async function getSeriesInfo(
  session: PlayerSession,
  seriesId: number,
): Promise<XtreamSeriesDetail | null> {
  const payload = (await requestJson(session, {
    action: 'get_series_info',
    series_id: String(seriesId),
  })) as Partial<XtreamSeriesDetail> | null;
  if (!payload || typeof payload !== 'object') return null;
  const episodes: Record<string, XtreamEpisode[]> = {};
  const rawEpisodes =
    payload.episodes && typeof payload.episodes === 'object'
      ? (payload.episodes as Record<string, unknown>)
      : {};
  for (const [season, list] of Object.entries(rawEpisodes)) {
    episodes[season] = asRecordArray(list).map((record) => ({
      id: String(record['id'] ?? ''),
      episode_num: numberField(record, 'episode_num'),
      title: stringField(record, 'title'),
      container_extension: stringField(record, 'container_extension') || 'mp4',
      season: numberField(record, 'season'),
      info: {
        plot: '',
        duration: '',
        duration_secs: 0,
        movie_image: '',
        rating: 0,
        season: 0,
        releasedate: '',
        ...(typeof record['info'] === 'object' && record['info'] !== null
          ? pickEpisodeInfo(record['info'] as Record<string, unknown>)
          : {}),
      },
    }));
  }
  return {
    seasons: Array.isArray(payload.seasons)
      ? (payload.seasons as Array<Record<string, unknown>>)
      : [],
    info: (payload.info ?? {}) as XtreamSeriesDetail['info'],
    episodes,
  };
}

function pickEpisodeInfo(info: Record<string, unknown>) {
  return {
    plot: stringField(info, 'plot'),
    duration: stringField(info, 'duration'),
    duration_secs: numberField(info, 'duration_secs'),
    movie_image: stringField(info, 'movie_image'),
    rating: numberField(info, 'rating'),
    season: numberField(info, 'season'),
    releasedate: stringField(info, 'releasedate'),
  };
}

export async function getVodInfo(
  session: PlayerSession,
  vodId: number,
): Promise<XtreamVodInfo | null> {
  const payload = (await requestJson(session, {
    action: 'get_vod_info',
    vod_id: String(vodId),
  })) as Partial<XtreamVodInfo> | null;
  if (!payload || typeof payload !== 'object' || !payload.movie_data) {
    return null;
  }
  return {
    info:
      payload.info && typeof payload.info === 'object'
        ? (payload.info as Record<string, unknown>)
        : {},
    movie_data: {
      stream_id: numberField(
        payload.movie_data as Record<string, unknown>,
        'stream_id',
      ),
      name: stringField(payload.movie_data as Record<string, unknown>, 'name'),
      container_extension: stringField(
        payload.movie_data as Record<string, unknown>,
        'container_extension',
      ),
      category_id: String(
        (payload.movie_data as Record<string, unknown>)['category_id'] ?? '',
      ),
    },
  };
}

export async function loadCatalogue(
  session: PlayerSession,
): Promise<Catalogue> {
  const [
    vodCategories,
    vodStreams,
    seriesCategories,
    series,
    liveCategories,
    liveStreams,
  ] = await Promise.all([
    requestJson(session, { action: 'get_vod_categories' }),
    requestJson(session, { action: 'get_vod_streams' }),
    requestJson(session, { action: 'get_series_categories' }),
    requestJson(session, { action: 'get_series' }),
    requestJson(session, { action: 'get_live_categories' }),
    requestJson(session, { action: 'get_live_streams' }),
  ]);
  return {
    vodCategories: normalizeCategories(vodCategories),
    vodStreams: normalizeStreams(vodStreams),
    seriesCategories: normalizeCategories(seriesCategories),
    series: normalizeSeries(series),
    liveCategories: normalizeCategories(liveCategories),
    liveStreams: normalizeStreams(liveStreams),
  };
}

/**
 * Builds the token-authenticated playback path for a stream. The server
 * answers with a redirect to the current provider URL, so the browser talks
 * to the provider directly.
 */
export function playbackUrl(
  session: PlayerSession,
  mediaType: 'live' | 'vod' | 'series',
  streamFile: string,
): string {
  const section =
    mediaType === 'vod' ? 'movie' : mediaType === 'series' ? 'series' : 'live';
  const base = trimTrailingSlash(session.serverUrl) || window.location.origin;
  return `${base}/${section}/${XTREAM_USERNAME}/${encodeURIComponent(
    session.token,
  )}/${encodeURIComponent(streamFile)}`;
}
