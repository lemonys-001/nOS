const Auth = {
  SESSION_KEY: 'lemon.session',

  getSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (session.exp && Date.now() >= session.exp * 1000) {
        localStorage.removeItem(this.SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  isSignedIn() {
    return this.getSession() !== null;
  },

  userId() {
    const session = this.getSession();
    return session ? session.userId : null;
  },

  _firebase: null,
  _firebasePromise: null,

  loadFirebaseSdk() {
    if (this._firebase) return Promise.resolve(this._firebase);
    if (this._firebasePromise) return this._firebasePromise;
    const load = (src) => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(script);
    });
    this._firebasePromise = load('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
      .then(() => load('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js'))
      .then(() => {
        if (!CONFIG.firebase) throw new Error('Firebase is not configured');
        if (!firebase.apps.length) firebase.initializeApp(CONFIG.firebase);
        this._firebase = firebase;
        return firebase;
      });
    return this._firebasePromise;
  },

  _attachProviderButton(container, label, icon, handler) {
    container.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-ghost';
    btn.innerHTML = icon + '<span>' + label + '</span>';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      const res = await handler();
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      if (!res.ok) {
        const status = document.getElementById('lock-status');
        if (status) status.textContent = res.error || 'Sign-in failed.';
      }
    });
    container.appendChild(btn);
  },

  attachGoogleButton(container) {
    this._attachProviderButton(container, 'Sign in with Google',
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.4 3-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6Z"/></svg>',
      () => this.signInWithGoogle());
    return Promise.resolve();
  },

  _storageId(prefix, raw) {
    const clean = String(raw || '').replace(/[^A-Za-z0-9._-]/g, '');
    return prefix + (clean || 'user');
  },

  _saveFirebaseUser(user, providerId) {
    const google = (user.providerData || []).find((p) => p.providerId === 'google.com');
    let userId, provider;
    if (providerId === 'google.com' || google) {
      userId = this._storageId('g_', google ? google.uid : user.uid);
      provider = 'google';
    } else {
      userId = this._storageId('e_', user.uid);
      provider = 'email';
    }
    this._saveSession({
      userId,
      provider,
      name: user.displayName || user.email || 'User',
      email: user.email || '',
      picture: user.photoURL || '',
      exp: 0
    });
    return { ok: true, user };
  },

  _authError(e, fallback) {
    const code = String((e && e.code) || '');
    const messages = {
      'auth/popup-blocked': 'The sign-in popup was blocked. Allow popups for this site and try again.',
      'auth/popup-closed-by-user': 'Sign-in was cancelled.',
      'auth/cancelled-popup-request': 'Sign-in was cancelled.',
      'auth/operation-not-allowed': 'That sign-in method is not enabled for this Firebase project.',
      'auth/configuration-not-found': 'Firebase Authentication is not set up for this project yet. Enable it in the Firebase console.',
      'auth/invalid-api-key': 'The Firebase API key is invalid. Check the Firebase config.',
      'auth/app-not-authorized': 'This app is not authorized to use Firebase Authentication.',
      'auth/unauthorized-domain': 'This domain is not authorized for sign-in. Add it in Firebase Authentication settings.',
      'auth/network-request-failed': 'Sign-in could not reach the network. Check your connection and try again.',
      'auth/email-already-in-use': 'That email already has an account — sign in instead.',
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/weak-password': 'Use a password with at least 6 characters.',
      'auth/user-not-found': 'No account matches that email.',
      'auth/wrong-password': 'That password is incorrect.',
      'auth/invalid-credential': 'That email or password is incorrect.',
      'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
      'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method. Sign in with that method first.',
      'auth/requires-recent-login': 'Sign in again to continue.'
    };
    return messages[code] || (e && e.message) || fallback;
  },

  async signInWithGoogle() {
    try {
      const fb = await this.loadFirebaseSdk();
      const provider = new fb.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await fb.auth().signInWithPopup(provider);
      return this._saveFirebaseUser(result.user, 'google.com');
    } catch (e) {
      return { ok: false, error: this._authError(e, 'Google sign-in failed.') };
    }
  },

  signInGuest() {
    const rand = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2))
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 16);
    this._saveSession({
      userId: 'guest_' + rand,
      provider: 'guest',
      name: 'Guest User',
      email: '',
      picture: '',
      exp: 0
    });
  },

  signOut() {
    localStorage.removeItem(this.SESSION_KEY);
    if (this._firebase) this._firebase.auth().signOut().catch(() => {});
    document.dispatchEvent(new CustomEvent('lemon:signout'));
  },

  async signUpWithEmail(email, password) {
    try {
      const fb = await this.loadFirebaseSdk();
      const cred = await fb.auth().createUserWithEmailAndPassword(email, password);
      let sent = true;
      try {
        await cred.user.sendEmailVerification();
      } catch {
        sent = false;
      }
      await fb.auth().signOut();
      if (!sent) {
        return { ok: false, error: 'Account created, but the verification email could not be sent. Try signing in to resend it.' };
      }
      return { ok: true, verify: true };
    } catch (e) {
      return { ok: false, error: this._authError(e, 'Could not create the account.') };
    }
  },

  async signInWithEmail(email, password) {
    try {
      const fb = await this.loadFirebaseSdk();
      const cred = await fb.auth().signInWithEmailAndPassword(email, password);
      if (!cred.user.emailVerified) {
        let sent = true;
        try {
          await cred.user.sendEmailVerification();
        } catch {
          sent = false;
        }
        await fb.auth().signOut();
        return { ok: false, error: sent
          ? 'Verify your email first. A new verification link was sent to ' + email + '.'
          : 'Verify your email first. The verification link could not be resent; try again in a moment.' };
      }
      return this._saveFirebaseUser(cred.user, 'password');
    } catch (e) {
      return { ok: false, error: this._authError(e, 'Email sign-in failed.') };
    }
  },

  apiBase() {
    return (typeof CONFIG !== 'undefined' && CONFIG.apiBase ? CONFIG.apiBase : '/api/store').replace(/\/store\/?$/, '');
  },

  async ensureUsername() {
    const session = this.getSession();
    if (!session) return null;
    if (session.username) return session.username;
    try {
      const res = await fetch(this.apiBase() + '/username', {
        headers: { Authorization: 'Bearer ' + session.userId }
      });
      const body = await res.json();
      if (body.ok && body.username) {
        session.username = body.username;
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return body.username;
      }
    } catch {}
    return null;
  },

  async searchUsernames(query) {
    const session = this.getSession();
    if (!session) return [];
    const q = String(query || '').trim();
    if (!q) return [];
    try {
      const res = await fetch(this.apiBase() + '/username/search?q=' + encodeURIComponent(q), {
        headers: { Authorization: 'Bearer ' + session.userId }
      });
      const body = await res.json();
      return body && body.ok && Array.isArray(body.usernames) ? body.usernames : [];
    } catch {
      return [];
    }
  },

  async claimUsername(username) {
    const session = this.getSession();
    if (!session) return { ok: false, error: 'Not signed in' };
    try {
      const res = await fetch(this.apiBase() + '/username', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const body = await res.json();
      if (body.ok) {
        session.username = username;
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      }
      return body;
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async promptUsername() {
    const existing = await this.ensureUsername();
    if (existing) return existing;
    const UI = typeof window !== 'undefined' ? window.UI : null;
    if (!UI) return null;
    const username = await UI.prompt('Choose a username', { placeholder: 'alice', confirmLabel: 'Claim' });
    if (!username) return null;
    const res = await this.claimUsername(username);
    if (!res.ok) { UI.toast(res.error || 'Username unavailable'); return null; }
    return username;
  },

  _saveSession(session) {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    document.dispatchEvent(new CustomEvent('lemon:signin', { detail: session }));
  }
};

const Store = {
  _guestKey(app, key) {
    return 'lemon:guest:' + app + ':' + key;
  },

  _cacheKey(userId, app, key) {
    return 'lemon:cache:' + userId + ':' + app + ':' + key;
  },

  _cachePrefix(userId, app) {
    return 'lemon:cache:' + userId + ':' + (app ? app + ':' : '');
  },

  _parse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  _byteLength(str) {
    return new TextEncoder().encode(str).length;
  },

  _usageKey(userId) {
    return 'lemon:usage:' + userId;
  },

  _readUsage(userId) {
    const raw = localStorage.getItem(this._usageKey(userId));
    return raw ? this._parse(raw, null) : null;
  },

  _writeUsage(userId, used, quota) {
    if (typeof used !== 'number' || !isFinite(used)) return;
    localStorage.setItem(this._usageKey(userId), JSON.stringify({
      used: Math.max(0, used),
      quota: quota || 0,
      at: Date.now()
    }));
  },

  _noteSet(userId, serialized, previousRaw, body) {
    const cached = this._readUsage(userId);
    if (cached) {
      const delta = this._byteLength(serialized) - (previousRaw ? this._byteLength(previousRaw) : 0);
      this._writeUsage(userId, cached.used + delta, body.quota || cached.quota);
    } else if (body && typeof body.used === 'number') {
      this._writeUsage(userId, body.used, body.quota);
    }
  },

  _noteDelete(userId, previousRaw, body) {
    const cached = this._readUsage(userId);
    if (!cached) return;
    const freed = body && typeof body.freed === 'number'
      ? body.freed
      : (previousRaw ? this._byteLength(previousRaw) : 0);
    this._writeUsage(userId, cached.used - freed, cached.quota);
  },

  async get(app, key, fallback = null) {
    const session = Auth.getSession();
    if (!session) return fallback;
    if (session.provider === 'guest') {
      const raw = localStorage.getItem(this._guestKey(app, key));
      return raw === null ? fallback : this._parse(raw, fallback);
    }
    try {
      const res = await fetch(CONFIG.apiBase + '/' + encodeURIComponent(app) + '/' + encodeURIComponent(key), {
        headers: { Authorization: 'Bearer ' + session.userId }
      });
      const body = await res.json();
      if (body.ok && body.value !== undefined) {
        localStorage.setItem(this._cacheKey(session.userId, app, key), JSON.stringify(body.value));
        return body.value;
      }
      return fallback;
    } catch {
      const raw = localStorage.getItem(this._cacheKey(session.userId, app, key));
      return raw === null ? fallback : this._parse(raw, fallback);
    }
  },

  async set(app, key, value) {
    const session = Auth.getSession();
    if (!session) return false;
    const serialized = JSON.stringify(value);
    if (session.provider === 'guest') {
      localStorage.setItem(this._guestKey(app, key), serialized);
      return true;
    }
    const cacheKey = this._cacheKey(session.userId, app, key);
    const previousRaw = localStorage.getItem(cacheKey);
    localStorage.setItem(cacheKey, serialized);
    try {
      const res = await fetch(CONFIG.apiBase + '/' + encodeURIComponent(app) + '/' + encodeURIComponent(key), {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.userId,
          'Content-Type': 'application/json'
        },
        body: serialized
      });
      const body = await res.json();
      if (body.ok === true) this._noteSet(session.userId, serialized, previousRaw, body);
      return body.ok === true;
    } catch {
      return false;
    }
  },

  setWithProgress(app, key, value, onProgress) {
    const session = Auth.getSession();
    if (!session) return Promise.resolve(false);
    const serialized = JSON.stringify(value);
    if (session.provider === 'guest') {
      localStorage.setItem(this._guestKey(app, key), serialized);
      if (onProgress) onProgress(1);
      return Promise.resolve(true);
    }
    const cacheKey = this._cacheKey(session.userId, app, key);
    const previousRaw = localStorage.getItem(cacheKey);
    localStorage.setItem(cacheKey, serialized);
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', CONFIG.apiBase + '/' + encodeURIComponent(app) + '/' + encodeURIComponent(key));
      xhr.setRequestHeader('Authorization', 'Bearer ' + session.userId);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        let body = null;
        try { body = JSON.parse(xhr.responseText); } catch { body = null; }
        const ok = xhr.status >= 200 && xhr.status < 300 && body && body.ok === true;
        if (ok) this._noteSet(session.userId, serialized, previousRaw, body);
        resolve(ok);
      };
      xhr.onerror = () => resolve(false);
      xhr.ontimeout = () => resolve(false);
      xhr.send(serialized);
    });
  },

  async del(app, key) {
    const session = Auth.getSession();
    if (!session) return false;
    if (session.provider === 'guest') {
      localStorage.removeItem(this._guestKey(app, key));
      return true;
    }
    const cacheKey = this._cacheKey(session.userId, app, key);
    const previousRaw = localStorage.getItem(cacheKey);
    localStorage.removeItem(cacheKey);
    try {
      const res = await fetch(CONFIG.apiBase + '/' + encodeURIComponent(app) + '/' + encodeURIComponent(key), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + session.userId }
      });
      const body = await res.json();
      if (body.ok === true) this._noteDelete(session.userId, previousRaw, body);
      return body.ok === true;
    } catch {
      return false;
    }
  },

  async list(app) {
    const session = Auth.getSession();
    if (!session) return [];
    if (session.provider === 'guest') {
      const prefix = this._guestKey(app, '');
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix) && k.length > prefix.length) keys.push(k.slice(prefix.length));
      }
      return keys.sort();
    }
    try {
      const url = app ? CONFIG.apiBase + '/' + encodeURIComponent(app) : CONFIG.apiBase;
      const res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + session.userId }
      });
      const body = await res.json();
      if (body.ok && Array.isArray(body.keys)) return body.keys;
      return [];
    } catch {
      const prefix = this._cachePrefix(session.userId, app);
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix) && k.length > prefix.length) {
          let name = k.slice(prefix.length);
          if (!app) {
            const slash = name.indexOf(':');
            if (slash === -1) continue;
            name = name.slice(0, slash) + '/' + name.slice(slash + 1);
          }
          keys.push(name);
        }
      }
      return keys.sort();
    }
  },

  async usage() {
    const session = Auth.getSession();
    if (!session) return null;
    if (session.provider === 'guest') {
      const prefix = 'lemon:guest:';
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(prefix)) continue;
        const v = localStorage.getItem(k);
        used += k.length + (v ? v.length : 0);
      }
      return { used, quota: 0, local: true };
    }
    const cached = this._readUsage(session.userId);
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
      return { used: cached.used, quota: cached.quota, local: false, cached: true };
    }
    try {
      const url = CONFIG.apiBase.replace(/\/store\/?$/, '') + '/usage';
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + session.userId } });
      const body = await res.json();
      if (body && body.ok) {
        this._writeUsage(session.userId, body.used || 0, body.quota || 0);
        return { used: body.used || 0, quota: body.quota || 0, local: false };
      }
    } catch {
      /* offline */
    }
    if (cached) return { used: cached.used, quota: cached.quota, local: false, cached: true };
    return null;
  }
};
