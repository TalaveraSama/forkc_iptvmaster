/**
 * Client-side personalized ad selection.
 *
 * The engine is a pure function of the ads configuration, an impression
 * context (placement, media type, category, title, hour), persisted impression
 * counters, and an injectable random source, so it is fully unit-testable and
 * can later be replaced by a server-driven ad API without touching the UI:
 * components only ask "give me an ad for this placement and context".
 *
 * Personalization signals available today:
 * - what the viewer is watching (media type, category name, title keywords)
 * - local time of day
 * - per-ad daily frequency caps and per-placement hourly caps
 */

import type {
  AdCreative,
  AdsConfig,
  AdMediaType,
  PlacementName,
} from './config.js';

export interface AdContext {
  placement: PlacementName;
  /** Unknown contexts (e.g. a home banner) never match media-type targeting. */
  mediaType?: AdMediaType;
  categoryName?: string;
  title?: string;
  now: Date;
}

export interface AdCounters {
  /** Local day the daily counts belong to (YYYY-MM-DD). */
  dailyKey: string;
  daily: Record<string, number>;
  /** Local hour the hourly counts belong to (YYYY-MM-DDTHH). */
  hourlyKey: string;
  hourly: Record<string, number>;
}

export function dayKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function hourKey(now: Date): string {
  return `${dayKey(now)}T${String(now.getHours()).padStart(2, '0')}`;
}

export function emptyCounters(now: Date): AdCounters {
  return {
    dailyKey: dayKey(now),
    daily: {},
    hourlyKey: hourKey(now),
    hourly: {},
  };
}

/** Drops stored counters that belong to a previous day or hour. */
export function currentCounters(
  stored: AdCounters | null,
  now: Date,
): AdCounters {
  const fresh = emptyCounters(now);
  if (!stored) return fresh;
  return {
    dailyKey: fresh.dailyKey,
    daily: stored.dailyKey === fresh.dailyKey ? { ...stored.daily } : {},
    hourlyKey: fresh.hourlyKey,
    hourly: stored.hourlyKey === fresh.hourlyKey ? { ...stored.hourly } : {},
  };
}

export function dailyCount(counters: AdCounters, adId: string): number {
  return counters.daily[`ad:${adId}`] ?? 0;
}

export function hourlyCount(
  counters: AdCounters,
  placement: PlacementName,
): number {
  return counters.hourly[`placement:${placement}`] ?? 0;
}

/** Returns a new counters object with the impression recorded. */
export function recordImpression(
  counters: AdCounters,
  ad: AdCreative,
  context: AdContext,
): AdCounters {
  const fresh = currentCounters(counters, context.now);
  const adKey = `ad:${ad.id}`;
  const placementKey = `placement:${context.placement}`;
  return {
    ...fresh,
    daily: { ...fresh.daily, [adKey]: (fresh.daily[adKey] ?? 0) + 1 },
    hourly: {
      ...fresh.hourly,
      [placementKey]: (fresh.hourly[placementKey] ?? 0) + 1,
    },
  };
}

export function withinHours(
  hoursFrom: number | null,
  hoursTo: number | null,
  hour: number,
): boolean {
  if (hoursFrom === null || hoursTo === null) return true;
  return hoursFrom <= hoursTo
    ? hour >= hoursFrom && hour <= hoursTo
    : // Window wraps midnight, e.g. 22..02.
      hour >= hoursFrom || hour <= hoursTo;
}

/** Case- and accent-insensitive fold so "futbol" matches "Fútbol". */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function matchesSubstring(
  value: string | undefined,
  targets: string[],
): boolean {
  if (targets.length === 0) return true;
  if (!value) return false;
  const haystack = fold(value);
  return targets.some((target) => haystack.includes(fold(target)));
}

export function isAdEligible(ad: AdCreative, context: AdContext): boolean {
  const { targeting } = ad;
  if (targeting.mediaTypes.length > 0) {
    if (!context.mediaType) return false;
    if (!targeting.mediaTypes.includes(context.mediaType)) return false;
  }
  if (
    targeting.categories.length > 0 &&
    !matchesSubstring(context.categoryName, targeting.categories)
  ) {
    return false;
  }
  if (targeting.keywords.length > 0) {
    const haystack = `${context.title ?? ''} ${context.categoryName ?? ''}`;
    if (!matchesSubstring(haystack, targeting.keywords)) return false;
  }
  return withinHours(
    targeting.hoursFrom,
    targeting.hoursTo,
    context.now.getHours(),
  );
}

/**
 * Picks one ad for the placement and context, or null when advertising is
 * off, the placement is exhausted, or no creative is eligible. Eligible ads
 * compete by weight through the injected random source.
 */
export function pickAd(
  config: AdsConfig,
  context: AdContext,
  counters: AdCounters,
  rng: () => number = Math.random,
): AdCreative | null {
  if (!config.enabled) return null;
  const placement = config.placements[context.placement];
  if (!placement.enabled) return null;
  if (placement.maxPerHour <= 0) return null;
  if (hourlyCount(counters, context.placement) >= placement.maxPerHour) {
    return null;
  }

  const eligible = config.ads.filter(
    (ad) =>
      isAdEligible(ad, context) &&
      (ad.frequencyCapPerDay === null ||
        dailyCount(counters, ad.id) < ad.frequencyCapPerDay),
  );
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, ad) => sum + ad.weight, 0);
  let point = rng() * totalWeight;
  for (const ad of eligible) {
    point -= ad.weight;
    if (point < 0) return ad;
  }
  return eligible[eligible.length - 1] ?? null;
}
