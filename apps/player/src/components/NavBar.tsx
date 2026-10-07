import type { BrowseSection } from '../App.js';
import type { BrandingConfig } from '../config.js';

export function BrandMark({ branding }: { branding: BrandingConfig }) {
  if (branding.logoUrl) {
    return (
      <img
        className="brand-logo"
        src={branding.logoUrl}
        alt={branding.appName}
        onError={(event) => {
          event.currentTarget.classList.add('missing');
        }}
      />
    );
  }
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="28" height="28">
        <path d="M20 12 L52 32 L20 52 Z" fill="currentColor" />
      </svg>
    </span>
  );
}

const LINKS: Array<{
  section: BrowseSection | 'search';
  label: string;
  hash: string;
}> = [
  { section: 'home', label: 'Inicio', hash: '#/' },
  { section: 'movies', label: 'Películas', hash: '#/movies' },
  { section: 'series', label: 'Series', hash: '#/series' },
  { section: 'live', label: 'En vivo', hash: '#/live' },
  { section: 'search', label: 'Buscar', hash: '#/search' },
];

export function NavBar({
  branding,
  current,
  onOpenSettings,
  onLogout,
}: {
  branding: BrandingConfig;
  current: BrowseSection | 'search' | 'watch';
  onOpenSettings: () => void;
  onLogout: () => void;
}) {
  return (
    <nav className="navbar">
      <a className="brand" href="#/">
        <BrandMark branding={branding} />
        <span className="brand-name">{branding.appName}</span>
      </a>
      <div className="nav-links">
        {LINKS.filter(
          (link) => link.section !== 'live' || branding.showLiveSection,
        ).map((link) => (
          <a
            key={link.section}
            className={`nav-link${current === link.section ? ' active' : ''}`}
            href={link.hash}
          >
            {link.label}
          </a>
        ))}
      </div>
      <div className="nav-actions">
        <button
          type="button"
          className="btn btn-ghost nav-action"
          onClick={onOpenSettings}
          title="Personalizar nombre, logo y anuncios"
        >
          ⚙
        </button>
        <button
          type="button"
          className="btn btn-ghost nav-action"
          onClick={onLogout}
          title="Cerrar sesión"
        >
          ⏻
        </button>
      </div>
    </nav>
  );
}
