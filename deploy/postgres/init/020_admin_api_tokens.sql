-- Long-lived, revocable API tokens for the bundled mobile admin application.
--
-- The browser editor authenticates with short-lived HttpOnly session cookies
-- plus a CSRF pair. A Capacitor/WebView build cannot use those cookies because
-- it is served from a local origin (`https://localhost`) while the IPTVMaster
-- server lives on another host, so cross-origin requests would drop the
-- SameSite=Strict session cookie. The mobile app instead exchanges its
-- credentials once for a bearer token stored here and sends it in the
-- Authorization header on every request.
--
-- Only the SHA-256 hash of the token is stored, mirroring admin_session, so a
-- database leak cannot be replayed as a live token. Rows are revocable and
-- expire; expired rows are pruned by the maintenance scheduler and on insert.
CREATE TABLE admin_api_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_account(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX admin_api_token_expiry_idx ON admin_api_token (expires_at);
