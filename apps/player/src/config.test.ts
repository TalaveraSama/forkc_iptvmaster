import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADS,
  DEFAULT_BRANDING,
  parseAdsConfig,
  parseBrandingConfig,
} from './config.js';

describe('parseBrandingConfig', () => {
  it('returns defaults for missing or invalid documents', () => {
    expect(parseBrandingConfig(null).config).toEqual(DEFAULT_BRANDING);
    expect(parseBrandingConfig('nope').config).toEqual(DEFAULT_BRANDING);
    expect(parseBrandingConfig('nope').errors).toHaveLength(1);
  });

  it('applies valid fields and keeps defaults for absent ones', () => {
    const { config, errors } = parseBrandingConfig({
      appName: 'Cine Casa',
      accentColor: '#00a86b',
    });
    expect(errors).toEqual([]);
    expect(config.appName).toBe('Cine Casa');
    expect(config.accentColor).toBe('#00a86b');
    expect(config.tagline).toBe(DEFAULT_BRANDING.tagline);
    expect(config.showLiveSection).toBe(true);
  });

  it('rejects invalid colors, urls, enums, and booleans with errors', () => {
    const { config, errors } = parseBrandingConfig({
      appName: '',
      accentColor: 'red',
      logoUrl: 'javascript:alert(1)',
      heroSource: 'everything',
      showLiveSection: 'yes',
    });
    expect(config).toEqual(DEFAULT_BRANDING);
    expect(errors).toHaveLength(5);
  });

  it('accepts an empty logoUrl to restore the built-in mark', () => {
    const base = { ...DEFAULT_BRANDING, logoUrl: 'https://x/logo.png' };
    const { config, errors } = parseBrandingConfig({ logoUrl: '' }, base);
    expect(errors).toEqual([]);
    expect(config.logoUrl).toBe('');
  });

  it('merges overrides onto a provided base configuration', () => {
    const base = parseBrandingConfig({ appName: 'Mi TV' }).config;
    const { config } = parseBrandingConfig({ tagline: 'Nuevo lema' }, base);
    expect(config.appName).toBe('Mi TV');
    expect(config.tagline).toBe('Nuevo lema');
  });
});

describe('parseAdsConfig', () => {
  it('returns the default (empty) lineup for absent documents', () => {
    expect(parseAdsConfig(undefined).config).toEqual(DEFAULT_ADS);
  });

  it('parses a complete valid document', () => {
    const { config, errors } = parseAdsConfig({
      enabled: true,
      placements: { preroll: { enabled: true, maxPerHour: 2 } },
      ads: [
        {
          id: 'video-1',
          type: 'video',
          mediaUrl: 'https://cdn.example/ad.mp4',
          clickUrl: 'https://example.com',
          durationSec: 20,
          skipAfterSec: 5,
          weight: 4,
          frequencyCapPerDay: 3,
          targeting: {
            mediaTypes: ['vod', 'nope'],
            categories: ['Acción'],
            hoursFrom: 22,
            hoursTo: 2,
          },
        },
        {
          id: 'msg-1',
          type: 'message',
          title: 'Hola',
        },
      ],
    });
    expect(errors).toEqual([]);
    expect(config.placements.preroll.maxPerHour).toBe(2);
    expect(config.placements.banner).toEqual(DEFAULT_ADS.placements.banner);
    expect(config.ads).toHaveLength(2);
    const video = config.ads[0];
    expect(video?.targeting.mediaTypes).toEqual(['vod']);
    expect(video?.targeting.hoursFrom).toBe(22);
    expect(video?.weight).toBe(4);
    const message = config.ads[1];
    expect(message?.label).toBe('Promo');
    expect(message?.frequencyCapPerDay).toBeNull();
  });

  it('drops invalid ads individually and reports them', () => {
    const { config, errors } = parseAdsConfig({
      ads: [
        { id: 'ok', type: 'message', text: 'Casa' },
        { id: 'bad-type', type: 'hologram' },
        { id: 'no-media', type: 'image' },
        { type: 'message', title: 'sin id' },
        { id: 'ok', type: 'message', title: 'duplicado' },
        'garbage',
      ],
    });
    expect(config.ads.map((ad) => ad.id)).toEqual(['ok']);
    expect(errors).toHaveLength(5);
  });

  it('clamps skipAfterSec to the ad duration and weight to range', () => {
    const { config } = parseAdsConfig({
      ads: [
        {
          id: 'a',
          type: 'message',
          title: 'x',
          durationSec: 5,
          skipAfterSec: 30,
          weight: 9000,
        },
      ],
    });
    const ad = config.ads[0];
    expect(ad?.durationSec).toBe(5);
    expect(ad?.skipAfterSec).toBe(5);
    expect(ad?.weight).toBe(100);
  });

  it('rejects non-http media urls', () => {
    const { config } = parseAdsConfig({
      ads: [
        { id: 'a', type: 'image', mediaUrl: 'file:///etc/passwd' },
        { id: 'b', type: 'image', mediaUrl: 'https://cdn.example/a.jpg' },
      ],
    });
    expect(config.ads.map((ad) => ad.id)).toEqual(['b']);
  });
});
