async function getStoredValueWithMigration(storage, activeKey, legacyKeys = []) {
  const activeValue = await storage.getItem(activeKey);
  if (activeValue !== null) return activeValue;

  for (const legacyKey of legacyKeys) {
    const legacyValue = await storage.getItem(legacyKey);
    if (legacyValue === null) continue;

    try {
      await storage.setItem(activeKey, legacyValue);
      await storage.removeItem(legacyKey);
    } catch {
      // Keep loading the legacy value if copying or cleanup temporarily fails.
    }
    return legacyValue;
  }

  return null;
}

module.exports = { getStoredValueWithMigration };
