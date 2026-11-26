/**
 * Lightweight local persistence adapter for the RedSync hackathon prototype.
 * Isolated behind a clean module boundary so it can be replaced with a backend API later.
 */

const STORAGE_KEY = 'redsync_prototype_state_v1';

export function loadPrototypeState(fallbackState) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return fallbackState;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallbackState;
    const parsed = JSON.parse(raw);
    return {
      ...fallbackState,
      ...parsed,
      safetyConfig: {
        ...fallbackState.safetyConfig,
        ...(parsed.safetyConfig || {}),
      },
    };
  } catch {
    return fallbackState;
  }
}

export function savePrototypeState(state) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota / privacy-mode errors gracefully
  }
}

export function clearPrototypeState() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}
