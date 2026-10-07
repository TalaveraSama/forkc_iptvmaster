import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AdContext, AdCounters } from './ads.js';
import { currentCounters, pickAd, recordImpression } from './ads.js';
import type {
  AdCreative,
  AdsConfig,
  BrandingConfig,
  ParseResult,
} from './config.js';
import { DEFAULT_ADS, parseAdsConfig, parseBrandingConfig } from './config.js';
import type {
  FavoriteEntry,
  LocalOverrides,
  PlayerSession,
  ProgressEntry,
} from './storage.js';
import {
  clearLocalOverrides,
  clearSession,
  loadAdCounters,
  loadFavorites,
  loadLocalOverrides,
  loadProgress,
  loadSession,
  saveAdCounters,
  saveFavorites,
  saveLocalOverrides,
  saveProgress,
  saveSession,
} from './storage.js';
import type { Catalogue } from './xtream.js';
import { loadCatalogue } from './xtream.js';
import { AdOverlay } from './components/AdSlot.js';
import { DetailModal } from './components/DetailModal.js';
import { Home } from './components/Home.js';
import { Login } from './components/Login.js';
import { NavBar } from './components/NavBar.js';
import { SearchView } from './components/SearchView.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { Watch } from './components/Watch.js';

export type BrowseSection = 'home' | 'movies' | 'series' | 'live';

export type Route =
  | { view: BrowseSection }
  | { view: 'search' }
  | {
      view: 'watch';
      mediaType: 'live' | 'vod' | 'series';
      streamRef: string;
      title: string;
      poster: string;
    };

export interface DetailTarget {
  mediaType: 'vod' | 'series';
  id: number;
  title: string;
  poster: string;
  categoryName: string;
}

function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [path, query = ''] = clean.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'search') return { view: 'search' };
  if (parts[0] === 'watch' && parts[1] && parts[2]) {
    const mediaType = parts[1];
    if (mediaType === 'live' || mediaType === 'vod' || mediaType === 'series') {
      const params = new URLSearchParams(query);
      return {
        view: 'watch',
        mediaType,
        streamRef: decodeURIComponent(parts[2]),
        title: params.get('title') ?? '',
        poster: params.get('poster') ?? '',
      };
    }
  }
  if (parts[0] === 'movies') return { view: 'movies' };
  if (parts[0] === 'series') return { view: 'series' };
  if (parts[0] === 'live') return { view: 'live' };
  return { view: 'home' };
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}

export function watchRoute(
  mediaType: 'live' | 'vod' | 'series',
  streamRef: string,
  title: string,
  poster: string,
): string {
  const params = new URLSearchParams({ title, poster });
  return `#/watch/${mediaType}/${encodeURIComponent(streamRef)}?${params.toString()}`;
}

async function fetchJsonOrNull(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function App() {
  const [session, setSession] = useState<PlayerSession | null>(() =>
    loadSession(),
  );
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState('');
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.hash),
  );

  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [serverBranding, setServerBranding] = useState<BrandingConfig | null>(
    null,
  );
  const [ads, setAds] = useState<AdsConfig>(DEFAULT_ADS);
  const [serverAds, setServerAds] = useState<AdsConfig>(DEFAULT_ADS);
  const [configVersion, setConfigVersion] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [interstitial, setInterstitial] = useState<{
    ad: AdCreative;
    pending: DetailTarget;
  } | null>(null);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>(() =>
    loadFavorites(),
  );
  const [progress, setProgress] = useState<ProgressEntry[]>(() =>
    loadProgress(),
  );

  const [counters, setCounters] = useState<AdCounters>(() =>
    currentCounters(loadAdCounters(), new Date()),
  );
  const countersRef = useRef(counters);
  countersRef.current = counters;
  const adsRef = useRef(ads);
  adsRef.current = ads;

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Load the runtime configuration: built-in defaults < server JSON files <
  // local overrides edited from the settings panel.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const overrides: LocalOverrides = loadLocalOverrides();
      const [brandingRaw, adsRaw] = await Promise.all([
        fetchJsonOrNull(import.meta.env.BASE_URL + 'branding.json'),
        fetchJsonOrNull(import.meta.env.BASE_URL + 'ads.json'),
      ]);
      if (cancelled) return;
      const fromServer = parseBrandingConfig(brandingRaw ?? {});
      const adsFromServer =
        adsRaw === null ? DEFAULT_ADS : parseAdsConfig(adsRaw).config;
      setServerBranding(fromServer.config);
      setServerAds(adsFromServer);
      setBranding(
        overrides.branding
          ? parseBrandingConfig(overrides.branding, fromServer.config).config
          : fromServer.config,
      );
      setAds(
        overrides.ads !== undefined
          ? parseAdsConfig(overrides.ads).config
          : adsFromServer,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [configVersion]);

  useEffect(() => {
    if (branding) document.title = branding.appName;
  }, [branding]);

  useEffect(() => {
    if (!session) {
      setCatalogue(null);
      setCatalogueError('');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadCatalogue(session);
        if (!cancelled) {
          setCatalogue(loaded);
          setCatalogueError('');
        }
      } catch {
        if (!cancelled) {
          setCatalogue(null);
          setCatalogueError(
            'No se pudo cargar el catálogo. Verifica el token o la conexión con el servidor.',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const pickAdFor = useCallback((context: AdContext): AdCreative | null => {
    const fresh = currentCounters(countersRef.current, context.now);
    const ad = pickAd(adsRef.current, context, fresh);
    if (ad) {
      const next = recordImpression(fresh, ad, context);
      countersRef.current = next;
      setCounters(next);
      saveAdCounters(next);
    }
    return ad;
  }, []);

  const onLogin = useCallback((next: PlayerSession) => {
    saveSession(next);
    setSession(next);
    navigate('#/');
  }, []);

  const onLogout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const openDetail = useCallback(
    (target: DetailTarget) => {
      const ad = pickAdFor({
        placement: 'interstitial',
        mediaType: target.mediaType,
        categoryName: target.categoryName,
        title: target.title,
        now: new Date(),
      });
      if (ad) setInterstitial({ ad, pending: target });
      else setDetail(target);
    },
    [pickAdFor],
  );

  const toggleFavorite = useCallback((entry: FavoriteEntry) => {
    setFavorites((current) => {
      const exists = current.some((item) => item.key === entry.key);
      const next = exists
        ? current.filter((item) => item.key !== entry.key)
        : [{ ...entry, addedAt: Date.now() }, ...current];
      saveFavorites(next);
      return next;
    });
  }, []);

  const updateProgress = useCallback((entry: ProgressEntry | null) => {
    setProgress((current) => {
      if (!entry) return current;
      const without = current.filter((item) => item.key !== entry.key);
      // Less than 30 seconds watched, or near the end, is not worth resuming.
      const next =
        entry.positionSec < 30 ||
        (entry.durationSec > 0 && entry.positionSec > entry.durationSec - 60)
          ? without
          : [entry, ...without].slice(0, 20);
      saveProgress(next);
      return next;
    });
  }, []);

  const saveBrandingOverride = useCallback(
    (raw: Record<string, unknown>): ParseResult<BrandingConfig> => {
      const base = serverBranding ?? branding;
      const result = parseBrandingConfig(raw, base ?? undefined);
      const overrides = loadLocalOverrides();
      saveLocalOverrides({ ...overrides, branding: raw });
      setBranding(result.config);
      return result;
    },
    [serverBranding, branding],
  );

  const saveAdsOverride = useCallback(
    (raw: unknown): ParseResult<AdsConfig> => {
      const result = parseAdsConfig(raw);
      const overrides = loadLocalOverrides();
      saveLocalOverrides({ ...overrides, ads: raw });
      setAds(result.config);
      return result;
    },
    [],
  );

  const resetLocalConfig = useCallback(() => {
    clearLocalOverrides();
    if (serverBranding) setBranding(serverBranding);
    setAds(serverAds);
  }, [serverBranding, serverAds]);

  const reloadServerConfig = useCallback(() => {
    clearLocalOverrides();
    setConfigVersion((version) => version + 1);
  }, []);

  const theme = useMemo(
    () =>
      branding
        ? ({
            '--accent': branding.accentColor,
            '--bg': branding.backgroundColor,
          } as CSSProperties)
        : undefined,
    [branding],
  );

  if (!branding) {
    return (
      <div className="splash">
        <div className="splash-spinner" aria-label="Cargando" />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={theme}>
        <Login branding={branding} onLogin={onLogin} />
      </div>
    );
  }

  const content = (() => {
    if (route.view === 'watch') {
      return (
        <Watch
          session={session}
          mediaType={route.mediaType}
          streamRef={route.streamRef}
          title={route.title}
          poster={route.poster}
          progress={progress}
          pickAdFor={pickAdFor}
          onProgress={updateProgress}
        />
      );
    }
    if (!catalogue) {
      return (
        <div className="empty-state">
          <div className="splash-spinner" aria-label="Cargando catálogo" />
          {catalogueError ? (
            <p className="error-text">{catalogueError}</p>
          ) : null}
          {catalogueError ? (
            <button className="btn" onClick={onLogout}>
              Cambiar token
            </button>
          ) : null}
        </div>
      );
    }
    if (route.view === 'search') {
      return <SearchView catalogue={catalogue} onOpenDetail={openDetail} />;
    }
    return (
      <Home
        section={route.view}
        branding={branding}
        catalogue={catalogue}
        favorites={favorites}
        progress={progress}
        pickAdFor={pickAdFor}
        onOpenDetail={openDetail}
        onToggleFavorite={toggleFavorite}
      />
    );
  })();

  return (
    <div className="app-shell" style={theme}>
      <NavBar
        branding={branding}
        current={route.view}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={onLogout}
      />
      <main className="app-main">{content}</main>
      {detail && catalogue ? (
        <DetailModal
          session={session}
          catalogue={catalogue}
          target={detail}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onClose={() => setDetail(null)}
        />
      ) : null}
      {interstitial ? (
        <AdOverlay
          ad={interstitial.ad}
          onDone={() => {
            setDetail(interstitial.pending);
            setInterstitial(null);
          }}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsPanel
          branding={branding}
          ads={ads}
          onSaveBranding={saveBrandingOverride}
          onSaveAds={saveAdsOverride}
          onReset={resetLocalConfig}
          onReloadServer={reloadServerConfig}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}
