import { type FormEvent, useEffect, useState } from 'react';

import { App } from './App.js';
import {
  clearConnection,
  getServerBase,
  getToken,
  setServerBase,
  setToken,
} from './connection.js';
import { IconPlay } from './icons.js';

type Phase = 'server' | 'login' | 'ready';

async function readError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error ?? `Request failed (${response.status})`;
}

/**
 * Entry point for the bundled mobile build. It collects the IPTVMaster server
 * address, signs in for a bearer token, and only then renders the full editor.
 * The browser build uses AuthGate instead; this component is never mounted
 * there.
 */
export function MobileConnect() {
  const [phase, setPhase] = useState<Phase>('server');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authUsername, setAuthUsername] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  // On launch, resume an existing connection if the stored token is still
  // valid, otherwise drop back to the sign-in screen.
  useEffect(() => {
    let active = true;
    async function resume() {
      const base = getServerBase();
      const token = getToken();
      if (!base) {
        if (active) {
          setChecking(false);
          setPhase('server');
        }
        return;
      }
      if (active) setServer(base);
      if (!token) {
        if (active) {
          setChecking(false);
          setPhase('login');
        }
        return;
      }
      try {
        const response = await fetch('/api/v1/auth/status');
        const payload = (await response.json()) as {
          authenticated: boolean;
          username?: string;
        };
        if (!active) return;
        if (payload.authenticated) {
          setAuthUsername(payload.username);
          setPhase('ready');
        } else {
          setToken('');
          setPhase('login');
        }
      } catch {
        if (active) setPhase('login');
      } finally {
        if (active) setChecking(false);
      }
    }
    void resume();
    return () => {
      active = false;
    };
  }, []);

  // A 401 from any editor request means the token expired or was revoked;
  // send the user back to the sign-in screen.
  useEffect(() => {
    const onAuthRequired = () => {
      setToken('');
      setAuthUsername(undefined);
      setError('Your session expired. Please sign in again.');
      setPhase('login');
    };
    window.addEventListener(
      'iptvmaster:authentication-required',
      onAuthRequired,
    );
    return () =>
      window.removeEventListener(
        'iptvmaster:authentication-required',
        onAuthRequired,
      );
  }, []);

  function saveServer(event: FormEvent) {
    event.preventDefault();
    const value = server.trim();
    if (!value) {
      setError('Enter the IPTVMaster server address.');
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      setError('That does not look like a valid URL.');
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      setError('Use an http:// or https:// address.');
      return;
    }
    setServerBase(parsed.origin);
    setError(null);
    setPhase('login');
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/auth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const payload = (await response.json()) as {
        token: string;
        username: string;
      };
      setToken(payload.token);
      setAuthUsername(payload.username);
      setPassword('');
      setPhase('ready');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  function disconnect() {
    clearConnection();
    setAuthUsername(undefined);
    setPassword('');
    setError(null);
    setPhase('server');
  }

  if (checking) {
    return (
      <main className="auth-shell">
        <section className="auth-card" aria-busy="true">
          <div className="auth-brand">
            <span className="brand-mark">
              <IconPlay width={18} height={18} />
            </span>
            <div>
              <strong>IPTVMaster</strong>
              <small>Local playlist control</small>
            </div>
          </div>
          <p className="panel-copy">Connecting…</p>
        </section>
      </main>
    );
  }

  if (phase === 'ready') {
    return <App authUsername={authUsername} onLogout={disconnect} />;
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-busy={submitting}>
        <div className="auth-brand">
          <span className="brand-mark">
            <IconPlay width={18} height={18} />
          </span>
          <div>
            <strong>IPTVMaster</strong>
            <small>Local playlist control</small>
          </div>
        </div>

        {phase === 'server' ? (
          <form onSubmit={saveServer}>
            <p className="eyebrow">CONNECT</p>
            <h1>Server address</h1>
            <p className="panel-copy">
              Enter the address of your IPTVMaster server, for example{' '}
              <code>http://192.168.1.50:8080</code>.
            </p>
            <label htmlFor="mobile-server">Server URL</label>
            <input
              id="mobile-server"
              value={server}
              onChange={(event) => setServer(event.target.value)}
              placeholder="http://192.168.1.50:8080"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              autoFocus
            />
            <button type="submit">Continue</button>
          </form>
        ) : (
          <form onSubmit={signIn}>
            <p className="eyebrow">ADMINISTRATOR SIGN-IN</p>
            <h1>Welcome back</h1>
            <p className="panel-copy">
              Sign in to <code>{getServerBase()}</code>.
            </p>
            <label htmlFor="mobile-username">Username</label>
            <input
              id="mobile-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              minLength={3}
              maxLength={64}
              pattern="[A-Za-z0-9._-]+"
              required
              autoFocus
            />
            <label htmlFor="mobile-password">Password</label>
            <input
              id="mobile-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              maxLength={128}
              required
            />
            <button type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPhase('server');
              }}
            >
              Change server
            </button>
          </form>
        )}

        {error ? <p className="message error">{error}</p> : null}
      </section>
    </main>
  );
}
