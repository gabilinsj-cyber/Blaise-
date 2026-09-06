export class ServiceBusyError extends Error {
  constructor(message = 'service_busy') {
    super(message);
    this.name = 'ServiceBusyError';
  }
}

const TRANSIENT_STATUS = new Set([408, 425, 429]);
const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ECONNREFUSED',
  'EPIPE',
]);

export function isTransientGoogleError(error) {
  const status = Number(error?.response?.status ?? error?.status);
  if (Number.isInteger(status)) {
    return TRANSIENT_STATUS.has(status) || (status >= 500 && status <= 599);
  }
  const code = typeof error?.code === 'string' ? error.code : '';
  return TRANSIENT_CODES.has(code);
}

export async function retryTransient(
  operation,
  {
    maxAttempts = 3,
    baseDelayMillis = 50,
    maxDelayMillis = 500,
    sleep = (millis) => new Promise((resolve) => setTimeout(resolve, millis)),
    onRetry = () => {},
  } = {},
) {
  if (typeof operation !== 'function') throw new TypeError('operation_required');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
    throw new Error('invalid_retry_attempts');
  }
  if (!Number.isFinite(baseDelayMillis) || baseDelayMillis < 0) {
    throw new Error('invalid_retry_base_delay');
  }
  if (!Number.isFinite(maxDelayMillis) || maxDelayMillis < baseDelayMillis) {
    throw new Error('invalid_retry_max_delay');
  }

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientGoogleError(error)) throw error;
      onRetry(attempt, error);
      const delay = Math.min(maxDelayMillis, baseDelayMillis * (2 ** (attempt - 1)));
      if (delay > 0) await sleep(delay);
    }
  }
  throw lastError;
}

export function createConcurrencyGate({ maxConcurrent }) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 10_000) {
    throw new Error('invalid_concurrency_limit');
  }

  let active = 0;
  let peak = 0;
  let rejected = 0;

  return {
    async run(task) {
      if (typeof task !== 'function') throw new TypeError('task_required');
      if (active >= maxConcurrent) {
        rejected += 1;
        throw new ServiceBusyError();
      }
      active += 1;
      peak = Math.max(peak, active);
      try {
        return await task();
      } finally {
        active -= 1;
      }
    },
    snapshot() {
      return Object.freeze({ active, peak, rejected, maxConcurrent });
    },
  };
}
