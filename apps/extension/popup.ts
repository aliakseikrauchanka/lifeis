// SECURITY FIX: Use the production HTTPS URL as the default.
// Plain HTTP (http://localhost) transmits Authorization Bearer tokens in cleartext;
// other local processes can intercept loopback traffic on some OS configurations.
// Override to localhost only in development by setting the build-time constant
// via esbuild --define:__DEV__=true (see package.json build scripts).
declare const __DEV__: boolean | undefined;
const BE_URL: string =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? 'http://localhost/api'        // dev only — never ship this path to users
    : 'https://lifeis-agents.vercel.app/api';
const APP_ID = 'extension';

const LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'pl', label: 'Polish' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'de-DE', label: 'German' },
  { code: 'fr-FR', label: 'French' },
  { code: 'sr-RS', label: 'Serbian' },
  { code: 'fi', label: 'Finnish' },
  { code: 'es', label: 'Spanish' },
];

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  googleUserId: string;
}

async function getStoredAuth(): Promise<StoredAuth | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['accessToken', 'refreshToken', 'googleUserId'], (result) => {
      if (result.accessToken) {
        resolve(result as StoredAuth);
      } else {
        resolve(null);
      }
    });
  });
}

async function saveAuth(auth: StoredAuth): Promise<void> {
  // SECURITY NOTE: chrome.storage.local is unencrypted on disk and readable by all
  // contexts of this extension. The 'scripting' permission has been removed from
  // manifest.json (principle of least privilege) to reduce the attack surface.
  // Consider migrating to chrome.storage.session (Chrome 112+) so the token is
  // cleared automatically when the browser closes and is not persisted to disk.
  return new Promise((resolve) => {
    chrome.storage.local.set(auth, resolve);
  });
}

async function clearAuth(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['accessToken', 'refreshToken', 'googleUserId'], resolve);
  });
}

async function signIn(): Promise<void> {
  const accessToken = await new Promise<string>((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError?.message || 'Auth failed');
      } else {
        resolve(token);
      }
    });
  });

  // SECURITY NOTE: The access_token is sent as a URL query parameter because the
  // Google tokeninfo v1 endpoint does not accept it in the request body or headers.
  // This means the token appears in browser history for extension popup contexts.
  // To eliminate this exposure, consider switching to chrome.identity.getProfileUserInfo()
  // for the user ID (no network call required), and rely on the backend's own tokeninfo
  // check for server-side validation. The access token should only travel in the
  // Authorization: Bearer header (as done in fetchWithAuth), never in URLs.
  const userInfoRes = await fetch(
    `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`,
  );
  if (!userInfoRes.ok) throw new Error('Failed to get user info');
  const userInfo = await userInfoRes.json();

  await saveAuth({
    accessToken,
    refreshToken: '',
    googleUserId: userInfo.user_id,
  });
}

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const auth = await getStoredAuth();
  if (!auth) throw new Error('Not authenticated');
  return fetch(`${BE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${auth.accessToken}`,
      'x-app-id': APP_ID,
    },
  });
}

async function getSelectedText(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get('selectedText', (result) => {
      resolve(result.selectedText ?? '');
      chrome.storage.local.remove('selectedText');
    });
  });
}

function getSavedLangs(): { from: string; to: string } {
  const from = localStorage.getItem('ext-lang-from') ?? 'en-US';
  const to = localStorage.getItem('ext-lang-to') ?? 'pl';
  return { from, to };
}

function saveLangs(from: string, to: string) {
  localStorage.setItem('ext-lang-from', from);
  localStorage.setItem('ext-lang-to', to);
}

function langOptions(selectedCode: string): string {
  // SECURITY FIX: l.code and l.label are from the hardcoded LANGUAGES constant so
  // they are safe. selectedCode comes from localStorage and is used only for the
  // equality comparison (never interpolated into HTML), so this is safe. However,
  // to future-proof against any change that does interpolate selectedCode, we keep
  // the comparison strictly against the allowlist — only codes present in LANGUAGES
  // can produce a `selected` attribute, so a poisoned localStorage value is ignored.
  return LANGUAGES.map(
    (l) => `<option value="${l.code}" ${l.code === selectedCode ? 'selected' : ''}>${l.label}</option>`,
  ).join('');
}

function renderLoggedOut(content: HTMLElement) {
  content.innerHTML = `
    <div class="status">
      <div class="dot red"></div>
      <span>Not signed in</span>
    </div>
    <button class="btn-primary" id="signInBtn">Sign in with Google</button>
    <div id="error"></div>
  `;

  document.getElementById('signInBtn')!.addEventListener('click', async () => {
    const btn = document.getElementById('signInBtn') as HTMLButtonElement;
    const err = document.getElementById('error') as HTMLElement;
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    err.style.display = 'none';
    try {
      await signIn();
      await renderPopup();
    } catch (e) {
      err.style.display = 'block';
      err.textContent = e instanceof Error ? e.message : 'Sign in failed';
      btn.disabled = false;
      btn.textContent = 'Sign in with Google';
    }
  });
}

function renderLoggedIn(content: HTMLElement, selectedText: string) {
  const { from, to } = getSavedLangs();

  content.innerHTML = `
    <div class="status">
      <div class="dot green"></div>
      <span>Signed in</span>
    </div>
    <div class="translate-section">
      <div class="lang-row">
        <select id="langFrom">${langOptions(from)}</select>
        <button class="lang-swap" id="swapBtn" title="Swap languages">⇄</button>
        <select id="langTo">${langOptions(to)}</select>
      </div>
      <input class="word-input" id="wordInput" placeholder="Word or phrase…" value="${escapeHtml(selectedText)}" />
      <button class="btn-sm" id="translateBtn">Translate</button>
      <div id="translationOptions" class="translation-options"></div>
      <input class="translation-input" id="translationInput" placeholder="Translation…" style="display:none" />
      <button class="btn-sm" id="saveBtn" style="display:none">Save to Library</button>
      <div id="msg"></div>
    </div>
    <button class="btn-ghost" id="signOutBtn">Sign out</button>
  `;

  const langFrom = document.getElementById('langFrom') as HTMLSelectElement;
  const langTo = document.getElementById('langTo') as HTMLSelectElement;
  const wordInput = document.getElementById('wordInput') as HTMLInputElement;
  const translateBtn = document.getElementById('translateBtn') as HTMLButtonElement;
  const translationOptions = document.getElementById('translationOptions')!;
  const translationInput = document.getElementById('translationInput') as HTMLInputElement;
  const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
  const msg = document.getElementById('msg')!;

  langFrom.addEventListener('change', () => saveLangs(langFrom.value, langTo.value));
  langTo.addEventListener('change', () => saveLangs(langFrom.value, langTo.value));

  document.getElementById('swapBtn')!.addEventListener('click', () => {
    const tmp = langFrom.value;
    langFrom.value = langTo.value;
    langTo.value = tmp;
    saveLangs(langFrom.value, langTo.value);
  });

  translateBtn.addEventListener('click', async () => {
    const text = wordInput.value.trim();
    if (!text) return;
    translateBtn.disabled = true;
    translateBtn.textContent = 'Translating…';
    // SECURITY FIX: use clearMsg() instead of msg.innerHTML = '' for consistency
    clearMsg();
    translationOptions.innerHTML = '';
    translationInput.style.display = 'none';
    saveBtn.style.display = 'none';

    try {
      const res = await fetchWithAuth('/translations/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          targetLanguage: langTo.value,
          originalLanguage: langFrom.value,
        }),
      });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const data = await res.json();
      const translations: string[] = data.translations ?? [];

      translationInput.style.display = 'block';
      saveBtn.style.display = 'block';

      if (translations.length > 0) {
        translationOptions.innerHTML = translations
          .map((t: string) => `<button class="option-btn">${escapeHtml(t)}</button>`)
          .join('');

        translationOptions.querySelectorAll('.option-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            translationInput.value = btn.textContent ?? '';
            translationOptions.querySelectorAll('.option-btn').forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
          });
        });

        // Auto-select first option
        translationInput.value = translations[0];
        translationOptions.querySelector('.option-btn')?.classList.add('selected');
      }
    } catch (e) {
      // SECURITY FIX: Use setMsg() instead of msg.innerHTML to prevent XSS.
      // Error .message can contain attacker-influenced content (e.g. from a
      // manipulated network response when BE_URL is non-HTTPS). Using textContent
      // via a helper ensures no HTML is parsed from the error string.
      setMsg(e instanceof Error ? e.message : 'Translation failed', 'error');
    } finally {
      translateBtn.disabled = false;
      translateBtn.textContent = 'Translate';
    }
  });

  saveBtn.addEventListener('click', async () => {
    const original = wordInput.value.trim();
    const translation = translationInput.value.trim();
    if (!original || !translation) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    // SECURITY FIX: Clear message safely
    clearMsg();

    try {
      const res = await fetchWithAuth('/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original,
          translation,
          originalLanguage: langFrom.value,
          translationLanguage: langTo.value,
        }),
      });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      // SECURITY FIX: Use textContent instead of innerHTML for static success message
      setMsg('✓ Saved to library', 'success');
      // Clear form for next word
      wordInput.value = '';
      translationInput.value = '';
      translationInput.style.display = 'none';
      saveBtn.style.display = 'none';
      translationOptions.innerHTML = '';
    } catch (e) {
      // SECURITY FIX: Use setMsg() to avoid innerHTML injection from error messages
      setMsg(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save to Library';
    }
  });

  // Auto-translate if text was pre-selected
  if (selectedText) {
    translateBtn.click();
  }

  document.getElementById('signOutBtn')!.addEventListener('click', async () => {
    await clearAuth();
    await renderPopup();
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// SECURITY FIX: Safe message helpers that avoid innerHTML for dynamic content.
// msg.innerHTML was previously used to inject <span> elements containing
// error/success text — but error .message values can carry attacker-controlled
// strings (e.g. from a manipulated network error or bad URL). Using DOM methods
// (createElement + textContent + className) prevents any HTML from being parsed.
function setMsg(text: string, type: 'error' | 'success') {
  const msg = document.getElementById('msg');
  if (!msg) return;
  msg.textContent = '';
  const span = document.createElement('span');
  span.className = type === 'error' ? 'error-msg' : 'success-msg';
  span.textContent = text; // textContent, never innerHTML
  msg.appendChild(span);
}

function clearMsg() {
  const msg = document.getElementById('msg');
  if (msg) msg.textContent = '';
}

async function renderPopup() {
  const content = document.getElementById('content')!;
  const [auth, selectedText] = await Promise.all([getStoredAuth(), getSelectedText()]);

  if (auth) {
    renderLoggedIn(content, selectedText);
  } else {
    renderLoggedOut(content);
  }
}

renderPopup();
