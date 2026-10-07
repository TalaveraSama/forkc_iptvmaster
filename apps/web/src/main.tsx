import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { installApiSecurity } from './api-security.js';
import { AuthGate } from './AuthGate.js';
import { isMobileBuild } from './connection.js';
import { MobileConnect } from './MobileConnect.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');

installApiSecurity();

// The bundled mobile build collects a server address and a bearer token
// before showing the editor; the browser build uses the same-origin cookie
// gate. isMobileBuild() is a build-time constant, so each bundle keeps only
// the branch it needs.
createRoot(root).render(
  <StrictMode>{isMobileBuild() ? <MobileConnect /> : <AuthGate />}</StrictMode>,
);
