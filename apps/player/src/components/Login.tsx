import { useState } from 'react';
import type { FormEvent } from 'react';
import type { BrandingConfig } from '../config.js';
import type { PlayerSession } from '../storage.js';
import { authenticate } from '../xtream.js';
import { BrandMark } from './NavBar.js';

const DEMO_TOKEN = 'demotoken1234567890';

/**
 * Default server for the login form. On the web deployment the player shares
 * the API origin, so it can be pre-filled. Inside a packaged app (Capacitor
 * WebView) the origin is localhost or capacitor://, which is meaningless as
 * an IPTVMaster address, so the field starts empty there.
 */
function defaultServerUrl(): string {
  const origin = window.location.origin;
  const isPackaged =
    !import.meta.env.DEV &&
    (origin.startsWith('capacitor://') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');
  return isPackaged ? '' : origin;
}

export function Login({
  branding,
  onLogin,
}: {
  branding: BrandingConfig;
  onLogin: (session: PlayerSession) => void;
}) {
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const session: PlayerSession = {
      serverUrl: serverUrl.trim() || window.location.origin,
      token: token.trim(),
    };
    const result = await authenticate(session);
    setBusy(false);
    if (result.ok) onLogin(session);
    else setError(result.message);
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <BrandMark branding={branding} />
          <h1>{branding.appName}</h1>
          <p className="login-tagline">{branding.tagline}</p>
        </div>
        <label className="field">
          <span>Servidor</span>
          <input
            type="url"
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            placeholder="https://tu-servidor:8080"
            required
          />
        </label>
        <label className="field">
          <span>Token de salida</span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="El token del perfil de salida"
            autoComplete="off"
            required
            minLength={16}
          />
        </label>
        <p className="login-help">
          Usuario <code>iptvmaster</code> · El token aparece en el panel de
          IPTVMaster, dentro de cada perfil de salida.
        </p>
        {error ? <p className="error-text">{error}</p> : null}
        <button
          className="btn btn-play login-submit"
          type="submit"
          disabled={busy}
        >
          {busy ? 'Conectando…' : 'Entrar'}
        </button>
        {import.meta.env.DEV ? (
          <button
            type="button"
            className="btn btn-ghost login-demo"
            onClick={() => setToken(DEMO_TOKEN)}
          >
            Rellenar token de demostración
          </button>
        ) : null}
      </form>
    </div>
  );
}
