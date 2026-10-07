/**
 * Thin localStorage wrapper. Every read tolerates a missing, corrupt, or
 * forbidden store (private browsing) so the player keeps working without
 * persistence. Keys are namespaced to coexist with the admin editor on the
 * same origin.
 */

import type { AdCounters } from './ads.js';
import { currentCounters } from './ads.js';

const PREFIX = 'iptvmaster.player.';
const SESSION_KEY = PREFIX + 'session';
const OVERRIDES_KEY = PREFIX + 'local-config';
const FAVORITES_KEY = PREFIX + 'favorites';
const PROGRESS_KEY = PREFIX + 'progress';
const AD_COUNTERS_KEY = PREFIX + 'ad-counters';

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be full or unavailable; the session simply is not persisted.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignored for the same reasons as write().
  }
}

export interface PlayerSession {
  serverUrl: string;
  token: string;
}

export function loadSession(): PlayerSession | null {
  const stored = read<PlayerSession>(SESSION_KEY);
  if (
    !stored ||
    typeof stored.serverUrl !== 'string' ||
    typeof stored.token !== 'string' ||
    !stored.token
  ) {
    return null;
  }
  return stored;
}

export function saveSession(session: PlayerSession): void {
  write(SESSION_KEY, session);
}

export function clearSession(): void {
  remove(SESSION_KEY);
}

/** Raw (unvalidated) operator overrides edited from the settings panel. */
export interface LocalOverrides {
  branding?: Record<string, unknown>;
  ads?: unknown;
}

export function loadLocalOverrides(): LocalOverrides {
  const stored = read<LocalOverrides>(OVERRIDES_KEY);
  return stored && typeof stored === 'object' ? stored : {};
}

export function saveLocalOverrides(overrides: LocalOverrides): void {
  write(OVERRIDES_KEY, overrides);
}

export function clearLocalOverrides(): void {
  remove(OVERRIDES_KEY);
}

export interface FavoriteEntry {
  key: string;
  mediaType: 'live' | 'vod' | 'series';
  id: number;
  title: string;
  poster: string;
  addedAt: number;
}

export function loadFavorites(): FavoriteEntry[] {
  const stored = read<FavoriteEntry[]>(FAVORITES_KEY);
  return Array.isArray(stored)
    ? stored.filter((entry) => entry && typeof entry.key === 'string')
    : [];
}

export function saveFavorites(favorites: FavoriteEntry[]): void {
  write(FAVORITES_KEY, favorites.slice(0, 200));
}

export interface ProgressEntry {
  key: string;
  mediaType: 'live' | 'vod' | 'series';
  streamRef: string;
  title: string;
  poster: string;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
}

export function loadProgress(): ProgressEntry[] {
  const stored = read<ProgressEntry[]>(PROGRESS_KEY);
  return Array.isArray(stored)
    ? stored.filter((entry) => entry && typeof entry.key === 'string')
    : [];
}

export function saveProgress(progress: ProgressEntry[]): void {
  write(PROGRESS_KEY, progress.slice(0, 20));
}

export function loadAdCounters(): AdCounters | null {
  const stored = read<AdCounters>(AD_COUNTERS_KEY);
  if (!stored || typeof stored !== 'object') return null;
  return currentCounters(
    {
      dailyKey: String(stored.dailyKey ?? ''),
      daily:
        stored.daily && typeof stored.daily === 'object' ? stored.daily : {},
      hourlyKey: String(stored.hourlyKey ?? ''),
      hourly:
        stored.hourly && typeof stored.hourly === 'object' ? stored.hourly : {},
    },
    new Date(),
  );
}

export function saveAdCounters(counters: AdCounters): void {
  write(AD_COUNTERS_KEY, counters);
}
