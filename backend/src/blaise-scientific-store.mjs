export function createScientificStore({ now = Date.now } = {}) {
  const ttl = 24 * 60 * 60 * 1000;
  const records = new Map();
  let sequence = 0;
  let stopped = false;

  function remove(id) {
    clearTimeout(records.get(id)?.timer);
    records.delete(id);
  }

  return {
    add(report) {
      if (stopped) return;
      const data = structuredClone(report);
      const id = String(++sequence);
      const expiresAt = now() + ttl;
      const timer = setTimeout(() => remove(id), ttl);
      timer.unref?.();
      records.set(id, { data, expiresAt, timer });
      while (records.size > 2880) remove(records.keys().next().value);
    },
    read() {
      for (const [id, item] of records) {
        if (now() >= item.expiresAt) remove(id);
      }
      return Array.from(records.values(), item => ({
        report: structuredClone(item.data),
        expiresAt: new Date(item.expiresAt).toISOString()
      }));
    },
    stop() {
      stopped = true;
      for




(const id of records.keys()) remove(id);
    }
  };
}
