/**
 * Runtime branding and advertising configuration.
 *
 * Both files are plain JSON served next to the built player
 * (`branding.json`, `ads.json`), so an operator can rename the app, swap the
 * logo, or change the ad lineup later without rebuilding anything. Values are
 * validated field by field: an invalid field falls back to its default and is
 * reported so the in-app settings panel can explain what was rejected.
 */

export interface BrandingConfig {
  appName: string;
  tagline: string;
  /** Empty string means "use the built-in logo mark". */
  logoUrl: string;
  accentColor: string;
  backgroundColor: string;
  heroSource: 'series' | 'movies' | 'mixed';
  showLiveSection: boolean;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  appName: 'IPTVMaster Player',
  tagline: 'Tu cine en casa',
  logoUrl: '',
  accentColor: '#e50914',
  backgroundColor: '#0b0b0f',
  heroSource: 'series',
  showLiveSection: true,
};

export type AdType = 'image' | 'video' | 'message';
export type PlacementName = 'preroll' | 'banner' | 'interstitial';
export type AdMediaType = 'live' | 'vod' | 'series';

export const PLACEMENT_NAMES: PlacementName[] = [
  'preroll',
  'banner',
  'interstitial',
];

export interface AdTargeting {
  /** Empty list means "any media type" (when the context knows one). */
  mediaTypes: AdMediaType[];
  /** Matched as case-insensitive substrings of the context category name. */
  categories: string[];
  /** Matched as case-insensitive substrings of title or category name. */
  keywords: string[];
  /** Inclusive local hour window; null means unrestricted. Wraps midnight. */
  hoursFrom: number | null;
  hoursTo: number | null;
}

export interface AdCreative {
  id: string;
  type: AdType;
  label: string;
  title: string;
  text: string;
  mediaUrl: string;
  clickUrl: string;
  durationSec: number;
  skipAfterSec: number;
  weight: number;
  /** Maximum impressions per local day; null means unlimited. */
  frequencyCapPerDay: number | null;
  targeting: AdTargeting;
}

export interface PlacementConfig {
  enabled: boolean;
  maxPerHour: number;
}

export interface AdsConfig {
  enabled: boolean;
  placements: Record<PlacementName, PlacementConfig>;
  ads: AdCreative[];
}

export const DEFAULT_PLACEMENTS: Record<PlacementName, PlacementConfig> = {
  preroll: { enabled: true, maxPerHour: 6 },
  banner: { enabled: true, maxPerHour: 12 },
  interstitial: { enabled: true, maxPerHour: 3 },
};

export const DEFAULT_ADS: AdsConfig = {
  enabled: true,
  placements: { ...DEFAULT_PLACEMENTS },
  ads: [],
};

export interface ParseResult<T> {
  config: T;
  errors: string[];
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const HERO_SOURCES = ['series', 'movies', 'mixed'] as const;
const AD_TYPES = ['image', 'video', 'message'] as const;
const AD_MEDIA_TYPES = ['live', 'vod', 'series'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : fallback;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function integerInRange(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  return Math.min(maximum, Math.max(minimum, rounded));
}

function stringList(value: unknown, maximumLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => (typeof entry === 'string' ? [entry.trim()] : []))
    .filter((entry) => entry.length > 0 && entry.length <= maximumLength)
    .slice(0, 50);
}

/**
 * Validates a branding document on top of a base configuration. Missing keys
 * keep the base value silently; present-but-invalid keys keep the base value
 * and add an error.
 */
export function parseBrandingConfig(
  raw: unknown,
  base: BrandingConfig = DEFAULT_BRANDING,
): ParseResult<BrandingConfig> {
  const config: BrandingConfig = { ...base };
  const errors: string[] = [];
  if (raw === undefined || raw === null) return { config, errors };
  if (!isRecord(raw)) {
    return { config, errors: ['branding: el documento no es un objeto JSON'] };
  }

  if ('appName' in raw) {
    const value = text(raw['appName'], '', 80);
    if (value) config.appName = value;
    else errors.push('branding.appName debe ser texto de 1 a 80 caracteres');
  }
  if ('tagline' in raw) {
    const value = text(raw['tagline'], '', 160);
    if (value) config.tagline = value;
    else errors.push('branding.tagline debe ser texto de 1 a 160 caracteres');
  }
  if ('logoUrl' in raw) {
    // An explicit empty string restores the built-in logo mark.
    if (raw['logoUrl'] === '') config.logoUrl = '';
    else {
      const value = httpUrl(raw['logoUrl']);
      if (value) config.logoUrl = value;
      else errors.push('branding.logoUrl debe ser una URL http(s) válida');
    }
  }
  if ('accentColor' in raw) {
    const value =
      typeof raw['accentColor'] === 'string' &&
      HEX_COLOR.test(raw['accentColor'])
        ? raw['accentColor']
        : null;
    if (value) config.accentColor = value;
    else errors.push('branding.accentColor debe ser un color #rrggbb');
  }
  if ('backgroundColor' in raw) {
    const value =
      typeof raw['backgroundColor'] === 'string' &&
      HEX_COLOR.test(raw['backgroundColor'])
        ? raw['backgroundColor']
        : null;
    if (value) config.backgroundColor = value;
    else errors.push('branding.backgroundColor debe ser un color #rrggbb');
  }
  if ('heroSource' in raw) {
    const value = HERO_SOURCES.find((entry) => entry === raw['heroSource']);
    if (value) config.heroSource = value;
    else errors.push('branding.heroSource debe ser series, movies o mixed');
  }
  if ('showLiveSection' in raw) {
    if (typeof raw['showLiveSection'] === 'boolean') {
      config.showLiveSection = raw['showLiveSection'];
    } else {
      errors.push('branding.showLiveSection debe ser true o false');
    }
  }
  return { config, errors };
}

function parseTargeting(raw: unknown): AdTargeting {
  const targeting: AdTargeting = {
    mediaTypes: [],
    categories: [],
    keywords: [],
    hoursFrom: null,
    hoursTo: null,
  };
  if (!isRecord(raw)) return targeting;
  if (Array.isArray(raw['mediaTypes'])) {
    targeting.mediaTypes = raw['mediaTypes'].filter(
      (entry): entry is AdMediaType =>
        typeof entry === 'string' &&
        (AD_MEDIA_TYPES as readonly string[]).includes(entry),
    );
  }
  targeting.categories = stringList(raw['categories'], 120);
  targeting.keywords = stringList(raw['keywords'], 120);
  const hour = (value: unknown): number | null =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 23
      ? value
      : null;
  targeting.hoursFrom = hour(raw['hoursFrom']);
  targeting.hoursTo = hour(raw['hoursTo']);
  return targeting;
}

function parsePlacement(
  raw: unknown,
  fallback: PlacementConfig,
): PlacementConfig {
  if (!isRecord(raw)) return { ...fallback };
  return {
    enabled: typeof raw['enabled'] === 'boolean' ? raw['enabled'] : true,
    maxPerHour: integerInRange(raw['maxPerHour'], fallback.maxPerHour, 0, 120),
  };
}

function parseAd(raw: unknown): AdCreative | null {
  if (!isRecord(raw)) return null;
  const id = text(raw['id'], '', 64);
  const type = AD_TYPES.find((entry) => entry === raw['type']);
  if (!id || !type) return null;

  const mediaUrl =
    type === 'image' || type === 'video'
      ? (httpUrl(raw['mediaUrl']) ?? '')
      : '';
  if ((type === 'image' || type === 'video') && !mediaUrl) return null;
  const title = text(raw['title'], '', 200);
  const body = text(raw['text'], '', 1_000);
  if (type === 'message' && !title && !body) return null;

  const durationSec = integerInRange(
    raw['durationSec'],
    type === 'video' ? 15 : 6,
    1,
    120,
  );
  const skipAfterSec = integerInRange(raw['skipAfterSec'], 5, 0, durationSec);
  const capRaw = raw['frequencyCapPerDay'];
  const frequencyCapPerDay =
    capRaw === null || capRaw === undefined
      ? null
      : integerInRange(capRaw, 0, 1, 1_000) || null;

  return {
    id,
    type,
    label: text(raw['label'], type === 'message' ? 'Promo' : 'Anuncio', 40),
    title,
    text: body,
    mediaUrl,
    clickUrl: httpUrl(raw['clickUrl']) ?? '',
    durationSec,
    skipAfterSec,
    weight: integerInRange(raw['weight'], 1, 1, 100),
    frequencyCapPerDay,
    targeting: parseTargeting(raw['targeting']),
  };
}

/**
 * Validates a full advertising document. Unknown placements fall back to the
 * defaults, and individual invalid ads are dropped with an error instead of
 * rejecting the whole lineup.
 */
export function parseAdsConfig(raw: unknown): ParseResult<AdsConfig> {
  const config: AdsConfig = {
    enabled: true,
    placements: { ...DEFAULT_PLACEMENTS },
    ads: [],
  };
  const errors: string[] = [];
  if (raw === undefined || raw === null) return { config, errors };
  if (!isRecord(raw)) {
    return { config, errors: ['ads: el documento no es un objeto JSON'] };
  }

  if ('enabled' in raw) {
    if (typeof raw['enabled'] === 'boolean') config.enabled = raw['enabled'];
    else errors.push('ads.enabled debe ser true o false');
  }
  if (isRecord(raw['placements'])) {
    const placements = raw['placements'] as Record<string, unknown>;
    for (const name of PLACEMENT_NAMES) {
      config.placements[name] = parsePlacement(
        placements[name],
        DEFAULT_PLACEMENTS[name],
      );
    }
  }
  if ('ads' in raw) {
    if (!Array.isArray(raw['ads'])) errors.push('ads.ads debe ser una lista');
    else {
      const seen = new Set<string>();
      raw['ads'].slice(0, 100).forEach((entry, index) => {
        const ad = parseAd(entry);
        if (!ad) {
          const id = isRecord(entry) ? String(entry['id'] ?? '') : '';
          errors.push(
            `ads.ads[${index}]${id ? ` (${id})` : ''} no es válido y se omitió`,
          );
          return;
        }
        if (seen.has(ad.id)) {
          errors.push(`ads.ads[${index}] duplica el id "${ad.id}" y se omitió`);
          return;
        }
        seen.add(ad.id);
        config.ads.push(ad);
      });
    }
  }
  return { config, errors };
}
