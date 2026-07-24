/**
 * Simple PIN authentication using Web Crypto API.
 * PIN is hashed with SHA-256 and stored in localStorage.
 */
const Auth = (() => {
  /**
   * Hash a PIN with SHA-256 and return hex string.
   */
  async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Initialize auth with the default PIN from config.
   * Call once on first load.
   */
  async function init() {
    const existing = localStorage.getItem(CONFIG.pinHashKey);
    if (!existing) {
      const hash = await hashPin(CONFIG.defaultPin);
      localStorage.setItem(CONFIG.pinHashKey, hash);
    }
  }

  /**
   * Verify the entered PIN against stored hash.
   */
  async function verify(pin) {
    const storedHash = localStorage.getItem(CONFIG.pinHashKey);
    if (!storedHash) {
      await init();
      return verify(pin);
    }
    const enteredHash = await hashPin(pin);
    return enteredHash === storedHash;
  }

  /**
   * Change the PIN (requires current PIN for verification).
   */
  async function changePin(currentPin, newPin) {
    const isValid = await verify(currentPin);
    if (!isValid) return false;
    const newHash = await hashPin(newPin);
    localStorage.setItem(CONFIG.pinHashKey, newHash);
    return true;
  }

  /**
   * Create an authentication session.
   */
  function createSession() {
    const session = {
      authenticated: true,
      timestamp: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };
    sessionStorage.setItem(CONFIG.sessionKey, JSON.stringify(session));
  }

  /**
   * Check if there's a valid session.
   */
  function checkSession() {
    try {
      const raw = sessionStorage.getItem(CONFIG.sessionKey);
      if (!raw) return false;
      const session = JSON.parse(raw);
      if (session.expiresAt < Date.now()) {
        destroySession();
        return false;
      }
      return session.authenticated === true;
    } catch {
      return false;
    }
  }

  /**
   * Destroy the session (logout).
   */
  function destroySession() {
    sessionStorage.removeItem(CONFIG.sessionKey);
  }

  return { init, verify, changePin, createSession, checkSession, destroySession };
})();
