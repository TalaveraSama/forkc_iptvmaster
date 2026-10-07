import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AdsConfig, BrandingConfig, ParseResult } from '../config.js';

interface SettingsPanelProps {
  branding: BrandingConfig;
  ads: AdsConfig;
  onSaveBranding: (raw: Record<string, unknown>) => ParseResult<BrandingConfig>;
  onSaveAds: (raw: unknown) => ParseResult<AdsConfig>;
  onReset: () => void;
  onReloadServer: () => void;
  onClose: () => void;
}

export function SettingsPanel({
  branding,
  ads,
  onSaveBranding,
  onSaveAds,
  onReset,
  onReloadServer,
  onClose,
}: SettingsPanelProps) {
  const [appName, setAppName] = useState(branding.appName);
  const [tagline, setTagline] = useState(branding.tagline);
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl);
  const [accentColor, setAccentColor] = useState(branding.accentColor);
  const [backgroundColor, setBackgroundColor] = useState(
    branding.backgroundColor,
  );
  const [heroSource, setHeroSource] = useState(branding.heroSource);
  const [showLiveSection, setShowLiveSection] = useState(
    branding.showLiveSection,
  );
  const [adsText, setAdsText] = useState(() => JSON.stringify(ads, null, 2));
  const [messages, setMessages] = useState<string[]>([]);
  const [messageKind, setMessageKind] = useState<'ok' | 'error'>('ok');

  const showMessages = (result: ParseResult<unknown>, okText: string) => {
    if (result.errors.length > 0) {
      setMessageKind('error');
      setMessages(result.errors);
    } else {
      setMessageKind('ok');
      setMessages([okText]);
    }
  };

  const submitBranding = (event: FormEvent) => {
    event.preventDefault();
    showMessages(
      onSaveBranding({
        appName,
        tagline,
        logoUrl,
        accentColor,
        backgroundColor,
        heroSource,
        showLiveSection,
      }),
      'Marca aplicada en este dispositivo.',
    );
  };

  const submitAds = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(adsText);
    } catch (error) {
      setMessageKind('error');
      setMessages([
        `JSON inválido: ${error instanceof Error ? error.message : 'error desconocido'}`,
      ]);
      return;
    }
    showMessages(onSaveAds(parsed), 'Anuncios aplicados en este dispositivo.');
  };

  const exportAds = () => {
    const blob = new Blob([adsText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ads.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <aside
        className="settings-panel"
        role="dialog"
        aria-label="Personalización"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <h2>Personalización</h2>
          <button
            type="button"
            className="modal-close-inline"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <p className="settings-hint">
          Los cambios se guardan en este dispositivo. Para aplicarlos a todos
          los usuarios, edita <code>branding.json</code> y <code>ads.json</code>{' '}
          junto a los archivos del player (carpeta <code>public/player/</code>{' '}
          del servidor).
        </p>

        {messages.length > 0 ? (
          <ul className={`settings-messages ${messageKind}`}>
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}

        <form className="settings-section" onSubmit={submitBranding}>
          <h3>Marca (nombre y logo)</h3>
          <label className="field">
            <span>Nombre de la app</span>
            <input
              value={appName}
              onChange={(event) => setAppName(event.target.value)}
              maxLength={80}
            />
          </label>
          <label className="field">
            <span>Lema</span>
            <input
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
              maxLength={160}
            />
          </label>
          <label className="field">
            <span>
              URL del logo (http/https o vacío para el logo integrado)
            </span>
            <input
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://…/logo.png"
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Color de acento</span>
              <input
                type="color"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Color de fondo</span>
              <input
                type="color"
                value={backgroundColor}
                onChange={(event) => setBackgroundColor(event.target.value)}
              />
            </label>
          </div>
          <label className="field">
            <span>Contenido del banner principal</span>
            <select
              value={heroSource}
              onChange={(event) =>
                setHeroSource(
                  event.target.value as BrandingConfig['heroSource'],
                )
              }
            >
              <option value="series">Series</option>
              <option value="movies">Películas</option>
              <option value="mixed">Mixto</option>
            </select>
          </label>
          <label className="field field-check">
            <input
              type="checkbox"
              checked={showLiveSection}
              onChange={(event) => setShowLiveSection(event.target.checked)}
            />
            <span>Mostrar la sección «En vivo»</span>
          </label>
          <button type="submit" className="btn btn-play">
            Aplicar marca
          </button>
        </form>

        <section className="settings-section">
          <h3>Anuncios personalizados</h3>
          <p className="settings-hint">
            Edita el JSON completo: <code>enabled</code>, topes por hora en{' '}
            <code>placements</code> (preroll, banner, interstitial) y la lista{' '}
            <code>ads</code> con tipos <code>image</code>, <code>video</code> y{' '}
            <code>message</code>, pesos, límites diarios y segmentación por{' '}
            <code>mediaTypes</code>, <code>categories</code>,{' '}
            <code>keywords</code> y franja horaria.
          </p>
          <textarea
            className="ads-editor"
            spellCheck={false}
            rows={18}
            value={adsText}
            onChange={(event) => setAdsText(event.target.value)}
          />
          <div className="settings-actions">
            <button type="button" className="btn btn-play" onClick={submitAds}>
              Aplicar anuncios
            </button>
            <button type="button" className="btn btn-ghost" onClick={exportAds}>
              Descargar JSON
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>Configuración del servidor</h3>
          <div className="settings-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                onReloadServer();
                setMessageKind('ok');
                setMessages(['Configuración recargada desde el servidor.']);
              }}
            >
              Recargar desde el servidor
            </button>
            <button
              type="button"
              className="btn btn-ghost danger"
              onClick={() => {
                onReset();
                setMessageKind('ok');
                setMessages([
                  'Cambios locales descartados; rige la configuración del servidor.',
                ]);
              }}
            >
              Descartar cambios locales
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
