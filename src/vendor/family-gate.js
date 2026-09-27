/* =============================================================================
 * press family-gate.js — the ONE place the Family Wing sign-in flow is written
 * (docs/access-framework.md §7). Vendored into each tenant page the same way
 * src/gate.js is vendored into the personal apps, and guarded byte-for-byte by
 * the tenant's own `--check` (press's inline:check does not police sibling repos).
 *
 *   FamilyGate.require(page)  -> resolves {email,name} when a GRANTED session exists;
 *                                otherwise renders the full-page sign-in and resolves
 *                                after a granted sign-in completes.
 *   FamilyGate.requireSession() -> resolves {email,name} for a live family session; otherwise
 *                                renders the entrance sign-in (email OTP, NO page grant) and
 *                                resolves after sign-in. The Family-Wing DOOR uses this; a tenant
 *                                PAGE uses require(page). One session (press:family:v1) is shared,
 *                                so signing in at the door opens every tool with no further prompt.
 *   FamilyGate.session()      -> { email, name } | null   (sync, from local storage)
 *   FamilyGate.authHeaders()  -> { apikey, Authorization } for the tenant's own REST calls
 *   FamilyGate.signOut()      -> clears the local session (and best-effort GoTrue logout)
 *
 * Design notes:
 *   - It talks to Supabase Auth (GoTrue) and PostgREST with RAW fetch — NO supabase-js,
 *     no CDN, no runtime dep, matching the house "no network at boot for public pages"
 *     rule. persistSession / autoRefreshToken are implemented here (localStorage + a
 *     refresh timer), which is what the spec's "signed in effectively forever" means.
 *   - FAIL CLOSED is the whole point: reads of spaces.json and press_access_apps that
 *     error are treated as "gated". Zero auth calls happen until a page is known gated.
 *   - A failed token refresh renders the sign-in screen, never an error (spec §8).
 *   - The gate is courtesy; RLS is the lock (framework §2). Deleting this block yields a
 *     working app with nothing in it — every row is behind press_access_has('<page>').
 *
 * Node-importable: every DOM/browser touch is guarded, so the unit tests load this file
 * for its pure helpers (normSession, isExpired, sessionFromToken, gatedDecision, …) and
 * a Playwright spec drives the full flow against mocked GoTrue + PostgREST endpoints.
 * ========================================================================== */
(function (root) {
  'use strict';

  // --- config (all public / embeddable — the publishable anon key, same project) ---
  var SUPA_URL = 'https://eepjhpyziczrxvirczio.supabase.co';
  var SUPA_KEY = 'sb_publishable__iv3bI7xDAsOdHUlXzbVZQ_2yyFS4uX';
  var AUTH = SUPA_URL + '/auth/v1';
  var REST = SUPA_URL + '/rest/v1';
  var SESSION_KEY = 'press:family:v1';
  var REFRESH_SKEW_MS = 60 * 1000;   // treat a token as expired 60s early; refresh this far ahead

  // spaces.json sits beside the tenant page at the press root; a RELATIVE url resolves to
  // /press/spaces.json on the live site and to the served copy under a test origin. Overridable.
  var SPACES_URL = 'spaces.json';

  // Injectable seams for the unit tests (browser uses the real globals).
  var _fetch = (typeof fetch !== 'undefined') ? fetch.bind(globalThis) : null;
  var _store = (function () { try { return globalThis.localStorage || null; } catch (e) { return null; } })();

  function cfg(opts) {
    opts = opts || {};
    if (opts.fetch) _fetch = opts.fetch;
    if (opts.store) _store = opts.store;
    if (opts.spacesUrl) SPACES_URL = opts.spacesUrl;
    if (opts.supaUrl) { SUPA_URL = opts.supaUrl; AUTH = SUPA_URL + '/auth/v1'; REST = SUPA_URL + '/rest/v1'; }
    if (opts.supaKey) SUPA_KEY = opts.supaKey;
    return { SUPA_URL: SUPA_URL, SUPA_KEY: SUPA_KEY, AUTH: AUTH, REST: REST, SPACES_URL: SPACES_URL };
  }

  // ── pure helpers (unit-tested; no I/O) ──────────────────────────────────────
  // Build a normalised session from a GoTrue token response. GoTrue `expires_at` is epoch
  // SECONDS; `expires_in` is seconds-from-now. Returns null unless both tokens are present.
  function sessionFromToken(tok) {
    if (!tok || typeof tok.access_token !== 'string' || typeof tok.refresh_token !== 'string') return null;
    var user = tok.user || {};
    var meta = user.user_metadata || {};
    var expMs = tok.expires_at ? (tok.expires_at * 1000)
              : (Date.now() + ((tok.expires_in || 3600) * 1000));
    return {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: expMs,
      email: String(user.email || '').toLowerCase(),
      name: meta.name || meta.full_name || null
    };
  }
  function normSession(o) {
    if (!o || typeof o !== 'object') return null;
    if (typeof o.access_token !== 'string' || typeof o.refresh_token !== 'string') return null;
    if (typeof o.expires_at !== 'number') return null;
    return { access_token: o.access_token, refresh_token: o.refresh_token,
             expires_at: o.expires_at, email: String(o.email || '').toLowerCase(), name: o.name || null };
  }
  // Decode a base64url JSON segment (a JWT payload) in both browser (atob) and Node (Buffer). Returns
  // null on anything malformed — never throws.
  function b64urlToJson(seg) {
    if (typeof seg !== 'string' || !seg) return null;
    try {
      var b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var txt;
      if (typeof atob === 'function') {
        var bin = atob(b64);
        // handle UTF-8 payloads correctly
        try { txt = decodeURIComponent(bin.split('').map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')); }
        catch (e) { txt = bin; }
      } else if (typeof Buffer !== 'undefined') {
        txt = Buffer.from(b64, 'base64').toString('utf8');
      } else { return null; }
      return JSON.parse(txt);
    } catch (e) { return null; }
  }
  // Parse a URL fragment ('#a=1&b=2' or 'a=1&b=2') into a plain object. Empty/garbage -> {}.
  function parseHashParams(hash) {
    var out = {};
    var s = String(hash == null ? '' : hash).replace(/^#/, '');
    if (!s) return out;
    s.split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = i === -1 ? pair : pair.slice(0, i);
      var v = i === -1 ? '' : pair.slice(i + 1);
      try { out[decodeURIComponent(k)] = decodeURIComponent(v); } catch (e) { out[k] = v; }
    });
    return out;
  }
  // Build a normalised session from a GoTrue magic-link URL fragment. The fragment carries
  // access_token (a JWT), refresh_token, expires_at/expires_in — the email/name come from the JWT
  // payload. Returns null unless BOTH tokens are present and the payload decodes (a malformed hash
  // falls through to the sign-in screen — spec §8, arc slice 2). Never throws.
  function sessionFromHash(hash, now) {
    var p = parseHashParams(hash);
    if (!p.access_token || !p.refresh_token) return null;
    var payload = b64urlToJson(String(p.access_token).split('.')[1]);
    if (!payload || !payload.email) return null;   // not a usable Supabase access token
    now = (typeof now === 'number') ? now : Date.now();
    var expMs = p.expires_at ? (Number(p.expires_at) * 1000)
              : (p.expires_in ? (now + Number(p.expires_in) * 1000)
              : (payload.exp ? (payload.exp * 1000) : (now + 3600 * 1000)));
    var meta = payload.user_metadata || {};
    return normSession({
      access_token: p.access_token, refresh_token: p.refresh_token, expires_at: expMs,
      email: payload.email, name: meta.name || meta.full_name || null,
    });
  }
  function isExpired(session, now, skewMs) {
    if (!session) return true;
    now = (typeof now === 'number') ? now : Date.now();
    skewMs = (typeof skewMs === 'number') ? skewMs : REFRESH_SKEW_MS;
    return now >= (session.expires_at - skewMs);
  }
  // The fail-closed union, as a pure decision (framework §3). `page` is gated when it is in
  // spaces.family, OR the DB says so, OR EITHER read failed.
  function gatedDecision(d) {
    d = d || {};
    if (!d.spacesOk) return true;            // spaces.json unreadable -> gate
    if (d.inSpacesFamily) return true;       // repo-owned gate
    if (!d.appsOk) return true;              // press_access_apps unreadable -> gate
    return !!d.appsGated;                     // DB half of the union
  }

  // ── local session store ─────────────────────────────────────────────────────
  function loadSession() {
    if (!_store) return null;
    try { return normSession(JSON.parse(_store.getItem(SESSION_KEY) || 'null')); }
    catch (e) { return null; }
  }
  function saveSession(s) {
    if (!_store || !s) return;
    try { _store.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function clearSession() {
    if (!_store) return;
    try { _store.removeItem(SESSION_KEY); } catch (e) {}
  }

  // ── network ─────────────────────────────────────────────────────────────────
  function authFetch() { if (!_fetch) throw new Error('no fetch available'); return _fetch; }
  function anonHeaders(extra) {
    var h = { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function bearerHeaders(session, extra) {
    var h = { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + (session ? session.access_token : SUPA_KEY),
              'Content-Type': 'application/json' };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  async function loadSpaces() {
    var r = await authFetch()(SPACES_URL, { headers: { 'Accept': 'application/json' } });
    if (!r || !r.ok) throw new Error('spaces ' + (r && r.status));
    return await r.json();
  }
  async function fetchApp(page, session) {
    // authenticated read of press_access_apps for one page; anon is revoked, so a signed-out
    // caller gets a non-2xx here and the caller fails closed.
    var r = await authFetch()(REST + '/press_access_apps?select=page,gated&page=eq.' + encodeURIComponent(page),
      { headers: bearerHeaders(session) });
    if (!r || !r.ok) throw new Error('apps ' + (r && r.status));
    var rows = await r.json();
    return (rows && rows[0]) || null;
  }
  async function hasGrant(session, page) {
    var r = await authFetch()(REST + '/rpc/press_access_has',
      { method: 'POST', headers: bearerHeaders(session), body: JSON.stringify({ page: page }) });
    if (!r || !r.ok) return false;
    var v = await r.json();
    return v === true;
  }
  function touch(session) {
    // fire-and-forget last_seen_at stamp (§6); never blocks sign-in and never throws.
    try {
      authFetch()(REST + '/rpc/press_access_touch',
        { method: 'POST', headers: bearerHeaders(session), body: '{}' }).catch(function () {});
    } catch (e) {}
  }
  async function sendCode(email) {
    var r = await authFetch()(AUTH + '/otp',
      { method: 'POST', headers: anonHeaders(), body: JSON.stringify({ email: email, create_user: false }) });
    return { ok: !!(r && r.ok), status: r && r.status };
  }
  // Verify an OTP. Returns { session, status, code } — session is null on any failure, and status +
  // the GoTrue error_code let the caller phrase the right message (a wrong/expired CODE is NOT an
  // address-not-on-the-list problem; see verifyErr). Never throws.
  async function verifyCode(email, token) {
    var r;
    try {
      r = await authFetch()(AUTH + '/verify',
        { method: 'POST', headers: anonHeaders(), body: JSON.stringify({ email: email, token: token, type: 'email' }) });
    } catch (e) { return { session: null, status: 0, code: 'network' }; }
    if (r && r.ok) {
      var okBody = {}; try { okBody = await r.json(); } catch (e) {}
      return { session: sessionFromToken(okBody), status: r.status, code: '' };
    }
    var code = '';
    try { var eb = await r.json(); code = String(eb.error_code || eb.code || eb.error || '').toLowerCase(); } catch (e) {}
    return { session: null, status: (r && r.status) || 0, code: code };
  }
  async function refresh(refreshToken) {
    var r = await authFetch()(AUTH + '/token?grant_type=refresh_token',
      { method: 'POST', headers: anonHeaders(), body: JSON.stringify({ refresh_token: refreshToken }) });
    if (!r || !r.ok) return null;
    return sessionFromToken(await r.json());
  }

  // Magic-link landing (arc slice 2). A SECOND entry point, not a replacement: if the page loaded
  // with a GoTrue token fragment (the link flow, which otherwise dead-ends), adopt it as the session
  // in the gate's normal format, strip the fragment from the URL, and return it. No fragment / a
  // malformed one -> null, and the normal code path runs unchanged. Browser-only; never throws.
  function consumeHashLanding() {
    try {
      if (typeof location === 'undefined' || !location.hash) return null;
      var s = sessionFromHash(location.hash);
      if (!s) return null;
      saveSession(s);
      // strip the token fragment so it never lingers in the address bar / history
      try {
        if (typeof history !== 'undefined' && history.replaceState) {
          history.replaceState(null, '', location.pathname + location.search);
        } else { location.hash = ''; }
      } catch (e) {}
      return s;
    } catch (e) { return null; }
  }

  // Resolve a usable session from storage, refreshing if needed. Returns a live session or null.
  async function ensureFresh() {
    consumeHashLanding();   // a fresh magic-link landing is adopted before we read storage

    var s = loadSession();
    if (!s) return null;
    if (!isExpired(s)) return s;
    var ns = await refresh(s.refresh_token);   // rotation, not expiry, is the usual cause
    if (!ns) { clearSession(); return null; }   // failed refresh -> sign-in, not an error
    saveSession(ns);
    return ns;
  }

  async function isGated(page) {
    var spaces;
    try { spaces = await loadSpaces(); }
    catch (e) { return gatedDecision({ spacesOk: false }); }
    var fam = (spaces && Array.isArray(spaces.family)) ? spaces.family : [];
    if (fam.indexOf(page) !== -1) return true;
    // not repo-gated — consult the DB half of the union, failing closed
    try {
      var s = loadSession();
      var app = await fetchApp(page, s);
      return gatedDecision({ spacesOk: true, inSpacesFamily: false, appsOk: true, appsGated: app ? app.gated : false });
    } catch (e) {
      return gatedDecision({ spacesOk: true, inSpacesFamily: false, appsOk: false });
    }
  }

  // ── auto-refresh timer (autoRefreshToken equivalent) ────────────────────────
  var _timer = null;
  function stopAutoRefresh() { if (_timer) { try { clearTimeout(_timer); } catch (e) {} _timer = null; } }
  function scheduleRefresh(session, onLost) {
    if (typeof setTimeout !== 'function') return;
    stopAutoRefresh();
    var delay = Math.max(5000, session.expires_at - Date.now() - REFRESH_SKEW_MS);
    _timer = setTimeout(async function () {
      var ns = await refresh(session.refresh_token);
      if (!ns) { clearSession(); stopAutoRefresh(); if (onLost) try { onLost(); } catch (e) {} return; }
      saveSession(ns);
      scheduleRefresh(ns, onLost);
    }, delay);
  }

  // ── the sign-in UI (browser only) ───────────────────────────────────────────
  var STYLE_ID = 'family-gate-style';
  var CSS =
    '#family-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
    'padding:24px;background:radial-gradient(130% 100% at 50% 0%,#131d2c 0%,#0d1420 72%);' +
    "font-family:Outfit,system-ui,-apple-system,'Segoe UI',sans-serif;color:#eae4d6}" +
    /* muted text colour, raised to clear WCAG AA on the card */
    '#family-gate *{box-sizing:border-box}' +
    '#family-gate .fg-card{width:100%;max-width:400px;text-align:center;padding:34px 26px;border-radius:14px;' +
    'background:rgba(19,29,44,.82);border:1px solid rgba(201,162,109,.28);box-shadow:0 24px 60px rgba(0,0,0,.5)}' +
    '#family-gate .fg-icon{width:44px;height:44px;margin:0 auto 14px;color:#c9a26d}' +
    '#family-gate .fg-icon svg{width:44px;height:44px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}' +
    '#family-gate h1{font-size:20px;font-weight:600;margin:0 0 8px;letter-spacing:.1px}' +
    '#family-gate p{font-size:13px;line-height:1.55;color:#8f9bab;margin:0 auto 20px;max-width:320px}' +
    '#family-gate label{display:block;text-align:left;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#8f9bab;margin:0 0 6px 2px}' +
    '#family-gate input{width:100%;min-height:48px;background:rgba(13,20,32,.6);border:1px solid rgba(201,162,109,.3);' +
    'border-radius:8px;padding:12px 14px;color:#eae4d6;font-size:16px;font-family:inherit;margin-bottom:14px}' +
    '#family-gate input:focus{outline:2px solid #c9a26d;outline-offset:1px}' +
    '#family-gate input::placeholder{color:#9aa6b6;opacity:1}' +
    '#family-gate .fg-code{letter-spacing:.4em;text-align:center;font-variant-numeric:tabular-nums}' +
    '#family-gate .fg-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;' +
    'font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#1a1205;cursor:pointer;border:0;border-radius:8px;' +
    'padding:14px 24px;background:#c9a26d;font-weight:600;font-family:inherit}' +
    '#family-gate .fg-btn:hover{filter:brightness(1.06)}' +
    '#family-gate .fg-btn[disabled]{opacity:.6;cursor:progress}' +
    '#family-gate .fg-msg{font-size:12.5px;margin-top:14px;min-height:1em;color:#eae4d6}' +
    '#family-gate .fg-msg.err{color:#c2686e}' +
    '#family-gate .fg-back{display:inline-block;margin-top:18px;font-size:12px;color:#8f9bab;text-decoration:none;' +
    'border-bottom:1px solid rgba(125,138,156,.4)}' +
    '#family-gate .fg-back:hover{color:#eae4d6}' +
    '#family-gate .fg-link{background:0;border:0;color:#8f9bab;font:inherit;font-size:12px;text-decoration:underline;' +
    'text-underline-offset:3px;cursor:pointer;margin-top:14px}';
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect>' +
    '<polyline points="3 7 12 13 21 7"></polyline></svg>';

  function injectStyle() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function removeGate() {
    if (typeof document === 'undefined') return;
    var el = document.getElementById('family-gate');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  // SEND-CODE path only. An OTP-send rejection can mean the address is not allowed to sign in, so
  // the family-list wording lives HERE (the UI stays deliberately non-committal to avoid an
  // enumeration oracle — this is the phrasing for where a send error is surfaced explicitly).
  function friendlyAuthErr(status) {
    if (status === 429) return 'Too many attempts just now — wait a minute and try again.';
    if (status === 403 || status === 422) return 'That address is not on the family list.';
    return 'That didn’t work. Check the code and try again.';
  }
  // VERIFY path. A 403/otp_expired or a 400/422 invalid token means the CODE was wrong or stale — the
  // address was already accepted at the send step, so this NEVER mentions the family list.
  function verifyErr(status, code) {
    if (status === 429) return 'Too many attempts just now — wait a minute and try again.';
    return 'That code didn’t work — check it or request a new one.';
  }
  // Supabase OTP length is configurable (6–10 digits); tolerate the whole range, digits only.
  function isValidCode(code) { return /^\d{6,10}$/.test(String(code == null ? '' : code).trim()); }

  // Render the sign-in and resolve `done` only on a granted sign-in. `existing` is a valid but
  // UN-granted session, if any (a signed-in address that lacks a grant for THIS page).
  function renderSignIn(page, done, existing, opts) {
    opts = opts || {};
    if (typeof document === 'undefined') { return; } // nothing to render in Node
    injectStyle();
    removeGate();
    var host = document.createElement('div');
    host.id = 'family-gate';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-label', 'Sign in to the Family Wing');

    var MARQUEE = 'index.html?view=family';

    if (existing) {
      host.innerHTML =
        '<div class="fg-card">' +
          '<div class="fg-icon">' + ICON + '</div>' +
          '<h1>You’re signed in.</h1>' +
          '<p>Signed in as <b>' + escapeHtml(existing.email) + '</b>, but that address doesn’t have access to this page yet. Ask Mark to grant it.</p>' +
          '<button class="fg-link" id="fg-signout" type="button">Sign in as someone else</button>' +
          '<div><a class="fg-back" href="' + MARQUEE + '">← the family wing</a></div>' +
        '</div>';
      document.body.appendChild(host);
      host.querySelector('#fg-signout').addEventListener('click', function () {
        clearSession(); renderSignIn(page, done, null);
      });
      return;
    }

    host.innerHTML =
      '<div class="fg-card">' +
        '<div class="fg-icon">' + ICON + '</div>' +
        '<h1>The Family Wing.</h1>' +
        '<p>Enter your email and we’ll send you a sign-in code. You’ll stay signed in on this device.</p>' +
        '<form id="fg-email-form">' +
          '<label for="fg-email">Your email</label>' +
          '<input id="fg-email" type="email" inputmode="email" autocomplete="email" autofocus placeholder="you@example.com" />' +
          '<button class="fg-btn" id="fg-send" type="submit">Send me a code</button>' +
        '</form>' +
        '<form id="fg-code-form" hidden>' +
          '<label for="fg-code">Sign-in code</label>' +
          '<input id="fg-code" class="fg-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="••••••" />' +
          '<button class="fg-btn" id="fg-verify" type="submit">Verify &amp; sign in</button>' +
        '</form>' +
        '<div class="fg-msg" id="fg-msg" aria-live="polite"></div>' +
        '<a class="fg-back" href="' + MARQUEE + '">← the family wing</a>' +
      '</div>';
    document.body.appendChild(host);

    var emailForm = host.querySelector('#fg-email-form');
    var codeForm = host.querySelector('#fg-code-form');
    var emailInput = host.querySelector('#fg-email');
    var codeInput = host.querySelector('#fg-code');
    var sendBtn = host.querySelector('#fg-send');
    var verifyBtn = host.querySelector('#fg-verify');
    var msg = host.querySelector('#fg-msg');
    var currentEmail = '';

    emailForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = String(emailInput.value || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.className = 'fg-msg err'; msg.textContent = 'Enter a valid email.'; return; }
      currentEmail = email;
      sendBtn.disabled = true; msg.className = 'fg-msg'; msg.textContent = 'Sending…';
      try {
        await sendCode(email); // deliberately non-committal on the result, to avoid leaking who is on the list
        emailForm.hidden = true; codeForm.hidden = false;
        msg.className = 'fg-msg';
        msg.textContent = 'If ' + email + ' is on the family list, a code is on its way. Enter it above.';
        if (codeInput.focus) codeInput.focus();
      } catch (err) {
        sendBtn.disabled = false; msg.className = 'fg-msg err'; msg.textContent = 'Couldn’t reach the mail service. Try again.';
      }
    });

    codeForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var code = String(codeInput.value || '').trim();
      if (!isValidCode(code)) { msg.className = 'fg-msg err'; msg.textContent = 'Enter the 6–10 digit code from your email.'; return; }
      verifyBtn.disabled = true; msg.className = 'fg-msg'; msg.textContent = 'Signing you in…';
      var res;
      try { res = await verifyCode(currentEmail, code); }
      catch (err) { res = { session: null, status: 0, code: 'network' }; }
      if (!res || !res.session) {
        verifyBtn.disabled = false; msg.className = 'fg-msg err';
        msg.textContent = verifyErr(res ? res.status : 0, res ? res.code : '');
        return;
      }
      var session = res.session;
      if (opts.sessionOnly) {              // entrance (Family-Wing door) — a valid family session is
        saveSession(session);              // enough; each tenant PAGE still gates its own data by grant.
        touch(session);
        removeGate();
        done({ email: session.email, name: session.name });
        return;
      }
      var granted = false;
      try { granted = await hasGrant(session, page); } catch (err) { granted = false; }
      if (!granted) {
        saveSession(session);
        renderSignIn(page, done, session); // signed in, but no grant for THIS page
        return;
      }
      saveSession(session);
      touch(session);
      removeGate();
      done({ email: session.email, name: session.name });
    });

    // allow a "resend" by going back to the email step
    codeForm.addEventListener('click', function () {}, { once: true });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ── public API ──────────────────────────────────────────────────────────────
  // require(page, opts?) -> Promise<{email,name}>. Resolves when a granted session exists;
  // otherwise mounts the sign-in and resolves after a granted sign-in. Public pages (a page
  // vendoring the gate but not gated) resolve immediately with whatever local session exists.
  function require_(page, opts) {
    cfg(opts);
    return (async function () {
      var gated = await isGated(page);
      if (!gated) { var s0 = loadSession(); return s0 ? { email: s0.email, name: s0.name } : null; }
      var s = await ensureFresh();
      if (s) {
        var granted = false;
        try { granted = await hasGrant(s, page); } catch (e) { granted = false; }
        if (granted) {
          touch(s);
          scheduleRefresh(s, function () { renderSignIn(page, function (id) { scheduleRefresh(loadSession(), function () {}); }, null); });
          return { email: s.email, name: s.name };
        }
        // valid session, no grant for this page
        return await new Promise(function (resolve) { renderSignIn(page, function (id) { var ns = loadSession(); if (ns) scheduleRefresh(ns, function () {}); resolve(id); }, s); });
      }
      return await new Promise(function (resolve) {
        renderSignIn(page, function (id) { var ns = loadSession(); if (ns) scheduleRefresh(ns, function () {}); resolve(id); }, null);
      });
    })();
  }

  // requireSession(opts) -> Promise<{email,name}>. The Family-Wing DOOR gate: resolves for any live
  // family session, otherwise mounts the entrance sign-in (email OTP, NO page grant) and resolves once
  // signed in. Makes ZERO network calls until the user acts (ensureFresh with no stored session is a
  // pure localStorage read). Per-page authorisation stays with require(page) on each tenant.
  function requireSession(opts) {
    cfg(opts);
    return (async function () {
      var s = await ensureFresh();
      if (s) { touch(s); scheduleRefresh(s, function () {}); return { email: s.email, name: s.name }; }
      return await new Promise(function (resolve) {
        renderSignIn(null, function (id) { var ns = loadSession(); if (ns) scheduleRefresh(ns, function () {}); resolve(id); }, null, { sessionOnly: true });
      });
    })();
  }

  function session() { var s = loadSession(); return s ? { email: s.email, name: s.name } : null; }
  function authHeaders() { var s = loadSession(); return bearerHeaders(s); }
  function accessToken() { var s = loadSession(); return s ? s.access_token : null; }
  async function signOut() {
    var s = loadSession();
    stopAutoRefresh();
    clearSession();
    if (s) { try { await authFetch()(AUTH + '/logout', { method: 'POST', headers: bearerHeaders(s), body: '{}' }); } catch (e) {} }
  }

  root.FamilyGate = {
    // public
    require: require_, requireSession: requireSession, session: session, signOut: signOut,
    authHeaders: authHeaders, accessToken: accessToken,
    // config / seams
    cfg: cfg, SUPA_URL: SUPA_URL, SUPA_KEY: SUPA_KEY, REST: REST, AUTH: AUTH, SESSION_KEY: SESSION_KEY,
    // exposed for unit tests
    sessionFromToken: sessionFromToken, normSession: normSession, isExpired: isExpired,
    parseHashParams: parseHashParams, b64urlToJson: b64urlToJson, sessionFromHash: sessionFromHash,
    consumeHashLanding: consumeHashLanding,
    gatedDecision: gatedDecision, isGated: isGated, ensureFresh: ensureFresh,
    loadSession: loadSession, saveSession: saveSession, clearSession: clearSession,
    sendCode: sendCode, verifyCode: verifyCode, refresh: refresh, hasGrant: hasGrant,
    friendlyAuthErr: friendlyAuthErr, verifyErr: verifyErr, isValidCode: isValidCode, escapeHtml: escapeHtml
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
