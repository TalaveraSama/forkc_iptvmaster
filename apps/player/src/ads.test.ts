import { describe, expect, it } from 'vitest';
import {
  currentCounters,
  dayKey,
  emptyCounters,
  hourKey,
  isAdEligible,
  pickAd,
  recordImpression,
  withinHours,
  type AdContext,
} from './ads.js';
import type { AdCreative, AdsConfig } from './config.js';
import { DEFAULT_ADS } from './config.js';

function ad(overrides: Partial<AdCreative> = {}): AdCreative {
  return {
    id: 'ad-1',
    type: 'message',
    label: 'Anuncio',
    title: 'Título',
    text: 'Texto',
    mediaUrl: '',
    clickUrl: '',
    durationSec: 6,
    skipAfterSec: 5,
    weight: 1,
    frequencyCapPerDay: null,
    targeting: {
      mediaTypes: [],
      categories: [],
      keywords: [],
      hoursFrom: null,
      hoursTo: null,
    },
    ...overrides,
  };
}

function context(overrides: Partial<AdContext> = {}): AdContext {
  return {
    placement: 'preroll',
    now: new Date(2026, 9, 6, 20, 30),
    ...overrides,
  };
}

function config(
  ads: AdCreative[],
  overrides: Partial<AdsConfig> = {},
): AdsConfig {
  // Deep-copy placements so tests may tweak caps without mutating the shared
  // module-level defaults.
  return {
    ...DEFAULT_ADS,
    placements: structuredClone(DEFAULT_ADS.placements),
    ads,
    ...overrides,
  };
}

describe('withinHours', () => {
  it('accepts any hour when the window is open', () => {
    expect(withinHours(null, null, 3)).toBe(true);
    expect(withinHours(8, null, 3)).toBe(true);
  });

  it('handles normal and midnight-wrapping windows', () => {
    expect(withinHours(9, 17, 12)).toBe(true);
    expect(withinHours(9, 17, 20)).toBe(false);
    expect(withinHours(22, 2, 23)).toBe(true);
    expect(withinHours(22, 2, 1)).toBe(true);
    expect(withinHours(22, 2, 12)).toBe(false);
  });
});

describe('isAdEligible', () => {
  it('matches media types only when the context provides one', () => {
    const targeted = ad({
      targeting: { ...ad().targeting, mediaTypes: ['vod'] },
    });
    expect(isAdEligible(targeted, context({ mediaType: 'vod' }))).toBe(true);
    expect(isAdEligible(targeted, context({ mediaType: 'series' }))).toBe(
      false,
    );
    expect(isAdEligible(targeted, context())).toBe(false);
  });

  it('matches categories and keywords ignoring case and accents', () => {
    const byCategory = ad({
      targeting: { ...ad().targeting, categories: ['acción'] },
    });
    expect(
      isAdEligible(
        byCategory,
        context({ categoryName: 'Peliculas de Accion' }),
      ),
    ).toBe(true);
    expect(
      isAdEligible(byCategory, context({ categoryName: 'Acción HD' })),
    ).toBe(true);
    expect(
      isAdEligible(byCategory, context({ categoryName: 'Documentales' })),
    ).toBe(false);

    const byKeyword = ad({
      targeting: { ...ad().targeting, keywords: ['futbol'] },
    });
    expect(isAdEligible(byKeyword, context({ title: 'Fútbol en vivo' }))).toBe(
      true,
    );
    expect(isAdEligible(byKeyword, context({ title: 'Cocina' }))).toBe(false);
  });

  it('applies the hour window from the context clock', () => {
    const night = ad({
      targeting: { ...ad().targeting, hoursFrom: 22, hoursTo: 6 },
    });
    expect(isAdEligible(night, context())).toBe(false);
    expect(
      isAdEligible(night, context({ now: new Date(2026, 9, 6, 23, 0) })),
    ).toBe(true);
  });
});

describe('pickAd', () => {
  it('returns null when advertising or the placement is off', () => {
    expect(
      pickAd(
        config([ad()], { enabled: false }),
        context(),
        emptyCounters(new Date()),
      ),
    ).toBeNull();
    const off: AdsConfig = config([ad()]);
    off.placements.preroll.enabled = false;
    expect(pickAd(off, context(), emptyCounters(new Date()))).toBeNull();
  });

  it('respects hourly placement caps', () => {
    const limited: AdsConfig = config([ad()]);
    limited.placements.preroll.maxPerHour = 1;
    let counters = emptyCounters(new Date(2026, 9, 6, 20, 0));
    expect(pickAd(limited, context(), counters)).not.toBeNull();
    counters = recordImpression(counters, ad(), context());
    expect(pickAd(limited, context(), counters)).toBeNull();
  });

  it('respects per-ad daily frequency caps', () => {
    const capped = ad({ id: 'capped', frequencyCapPerDay: 1 });
    let counters = emptyCounters(new Date(2026, 9, 6, 20, 0));
    expect(pickAd(config([capped]), context(), counters, () => 0)).toBe(capped);
    counters = recordImpression(counters, capped, context());
    expect(pickAd(config([capped]), context(), counters, () => 0)).toBeNull();
    // A new day resets the cap.
    counters = currentCounters(counters, new Date(2026, 9, 7, 20, 0));
    expect(pickAd(config([capped]), context(), counters, () => 0)).toBe(capped);
  });

  it('selects by weight using the injected rng', () => {
    const heavy = ad({ id: 'heavy', weight: 9 });
    const light = ad({ id: 'light', weight: 1 });
    const lineup = config([heavy, light]);
    const counters = emptyCounters(new Date());
    // Weights 9:1 split the [0,1) rng space at 0.9.
    expect(pickAd(lineup, context(), counters, () => 0)).toBe(heavy);
    expect(pickAd(lineup, context(), counters, () => 0.5)).toBe(heavy);
    expect(pickAd(lineup, context(), counters, () => 0.95)).toBe(light);
    expect(pickAd(lineup, context(), counters, () => 0.99999)).toBe(light);
  });

  it('skips ineligible ads and returns null when none remain', () => {
    const targeted = ad({
      targeting: { ...ad().targeting, categories: ['Terror'] },
    });
    expect(
      pickAd(
        config([targeted]),
        context({ categoryName: 'Comedia' }),
        emptyCounters(new Date()),
      ),
    ).toBeNull();
    expect(
      pickAd(
        config([targeted]),
        context({ categoryName: 'Terror Clásico' }),
        emptyCounters(new Date()),
      ),
    ).toBe(targeted);
  });
});

describe('counters', () => {
  it('keys counters by local day and hour', () => {
    const now = new Date(2026, 9, 6, 9, 5);
    expect(dayKey(now)).toBe('2026-10-06');
    expect(hourKey(now)).toBe('2026-10-06T09');
  });

  it('drops stale daily and hourly counts independently', () => {
    const morning = new Date(2026, 9, 6, 9, 0);
    let counters = emptyCounters(morning);
    counters = recordImpression(counters, ad(), context({ now: morning }));
    counters = recordImpression(counters, ad(), context({ now: morning }));

    // Same day, later hour: daily counts survive, hourly counts reset.
    const noon = currentCounters(counters, new Date(2026, 9, 6, 12, 0));
    expect(noon.daily['ad:ad-1']).toBe(2);
    expect(noon.hourly['placement:preroll']).toBeUndefined();

    // Next day: everything resets.
    const nextDay = currentCounters(noon, new Date(2026, 9, 7, 12, 0));
    expect(nextDay.daily).toEqual({});
    expect(nextDay.hourly).toEqual({});
  });

  it('records ad and placement impressions together', () => {
    const now = new Date(2026, 9, 6, 21, 0);
    const counters = recordImpression(
      emptyCounters(now),
      ad({ id: 'x' }),
      context({ placement: 'interstitial', now }),
    );
    expect(counters.daily['ad:x']).toBe(1);
    expect(counters.hourly['placement:interstitial']).toBe(1);
  });
});
