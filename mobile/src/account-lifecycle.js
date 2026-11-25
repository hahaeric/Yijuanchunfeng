const CREDENTIALS_KEY = 'yijuan-remembered-login-v1';
function guestAfterLogout(guest, current) {
  return { ...guest, pinyinCorrections: current.pinyinCorrections || {} };
}
function createRememberedLogin(store, native) {
  return {
    async load() {
      if (!native) return null;
      const raw = await store.getItemAsync(CREDENTIALS_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      return typeof value.username === 'string' && typeof value.password === 'string' ? value : null;
    },
    async save(enabled, username, password) {
      if (!native) return;
      if (enabled) await store.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ username, password }));
      else await store.deleteItemAsync(CREDENTIALS_KEY);
    },
    async clear() { if (native) await store.deleteItemAsync(CREDENTIALS_KEY); }
  };
}
module.exports = { guestAfterLogout, createRememberedLogin };
