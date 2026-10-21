export function createScientificAccess({
  verifyIdentity,
  allowedUids = []
} = {}) {
  const allowed = new Set(
    allowedUids.filter(uid =>
      typeof uid === 'string' && uid.trim().length > 0
    ).map(uid => uid.trim())
  );

  return async function canReadScientificReports(authorization) {
    if (allowed.size === 0 ||
        typeof verifyIdentity !== 'function' ||
        typeof authorization !== 'string') return false;
    try {
      const uid = await verifyIdentity(authorization);
      return typeof uid === 'string' && allowed.has(uid);
    } catch {
      return false;
    }
  };
}
