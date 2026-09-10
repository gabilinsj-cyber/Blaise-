import {
  OFFICIAL_SOURCE_NORMAL_REFRESH_MS,
  OFFICIAL_SOURCE_SEVERE_REFRESH_MS,
} from './official-source-cache.mjs';

const TASK_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MODES = new Set(['normal', 'severe']);
const MAX_TIMEOUT_MS = 2_147_483_647;

export class OfficialSourceSchedulerError extends Error {
  constructor(code) {
    super(code);
    this.name = 'OfficialSourceSchedulerError';
    this.code = code;
  }
}

export function officialSourceRefreshIntervalMs(mode) {
  if (mode === 'normal') return OFFICIAL_SOURCE_NORMAL_REFRESH_MS;
  if (mode === 'severe') return OFFICIAL_SOURCE_SEVERE_REFRESH_MS;
  throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_mode');
}

function clockValue(now) {
  const value = Number(now());
  if (!Number.isFinite(value)) {
    throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_clock');
  }
  return value;
}

function isoOrNull(value) {
  return value === null ? null : new Date(value).toISOString();
}

function safeErrorCode(error) {
  const code = typeof error?.code === 'string' ? error.code : 'task_failed';
  return /^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(code) ? code : 'task_failed';
}

function validateTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 32) {
    throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_tasks');
  }

  const seen = new Set();
  return tasks.map((task) => {
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_task');
    }
    if (typeof task.id !== 'string' || !TASK_ID.test(task.id)) {
      throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_task_id');
    }
    if (seen.has(task.id)) {
      throw new OfficialSourceSchedulerError('official_source_scheduler_duplicate_task_id');
    }
    if (typeof task.run !== 'function') {
      throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_task_runner');
    }
    seen.add(task.id);
    return Object.freeze({ id: task.id, run: task.run });
  }).sort((left, right) => left.id.localeCompare(right.id));
}

export function createOfficialSourceScheduler({
  tasks,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  maxConcurrency = 2,
  autoSchedule = true,
  onEvent = () => {},
} = {}) {
  if (typeof now !== 'function') {
    throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_clock');
  }
  if (typeof setTimer !== 'function' || typeof clearTimer !== 'function') {
    throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_timer');
  }
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 8) {
    throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_concurrency');
  }
  if (typeof autoSchedule !== 'boolean') {
    throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_auto_schedule');
  }
  if (typeof onEvent !== 'function') {
    throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_event_handler');
  }

  const validatedTasks = validateTasks(tasks);
  const states = validatedTasks.map((task) => ({
    id: task.id,
    run: task.run,
    running: false,
    nextDueAtMs: null,
    lastStartedAtMs: null,
    lastFinishedAtMs: null,
    lastOutcome: null,
    lastErrorCode: null,
    runCount: 0,
  }));

  let mode = 'normal';
  let started = false;
  let timer = null;

  function emit(event) {
    try {
      onEvent(Object.freeze(event));
    } catch {
      // Observability must never break source polling.
    }
  }

  function clearScheduledTimer() {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  }

  function scheduleTimer() {
    clearScheduledTimer();
    if (!autoSchedule || !started) return;

    const nextDueAtMs = states
      .filter((state) => !state.running && state.nextDueAtMs !== null)
      .reduce((earliest, state) => Math.min(earliest, state.nextDueAtMs), Number.POSITIVE_INFINITY);

    if (!Number.isFinite(nextDueAtMs)) return;
    const delay = Math.min(MAX_TIMEOUT_MS, Math.max(0, nextDueAtMs - clockValue(now)));
    timer = setTimer(() => {
      timer = null;
      void tick();
    }, delay);
    timer?.unref?.();
  }

  async function runTask(state, scheduledAtMs) {
    const startedAtMs = clockValue(now);
    state.running = true;
    state.nextDueAtMs = null;
    state.lastStartedAtMs = startedAtMs;
    state.runCount += 1;

    emit({
      type: 'task_started',
      taskId: state.id,
      mode,
      scheduledAt: new Date(scheduledAtMs).toISOString(),
      startedAt: new Date(startedAtMs).toISOString(),
      runCount: state.runCount,
    });

    try {
      await state.run(Object.freeze({
        taskId: state.id,
        mode,
        scheduledAt: new Date(scheduledAtMs).toISOString(),
        startedAt: new Date(startedAtMs).toISOString(),
      }));
      const finishedAtMs = clockValue(now);
      state.running = false;
      state.lastFinishedAtMs = finishedAtMs;
      state.lastOutcome = 'SUCCESS';
      state.lastErrorCode = null;
      state.nextDueAtMs = finishedAtMs + officialSourceRefreshIntervalMs(mode);
      emit({
        type: 'task_finished',
        taskId: state.id,
        outcome: 'SUCCESS',
        mode,
        finishedAt: new Date(finishedAtMs).toISOString(),
        nextDueAt: new Date(state.nextDueAtMs).toISOString(),
        runCount: state.runCount,
      });
    } catch (error) {
      const finishedAtMs = clockValue(now);
      state.running = false;
      state.lastFinishedAtMs = finishedAtMs;
      state.lastOutcome = 'FAILURE';
      state.lastErrorCode = safeErrorCode(error);
      state.nextDueAtMs = finishedAtMs + officialSourceRefreshIntervalMs(mode);
      emit({
        type: 'task_finished',
        taskId: state.id,
        outcome: 'FAILURE',
        errorCode: state.lastErrorCode,
        mode,
        finishedAt: new Date(finishedAtMs).toISOString(),
        nextDueAt: new Date(state.nextDueAtMs).toISOString(),
        runCount: state.runCount,
      });
    } finally {
      scheduleTimer();
    }
  }

  async function tick() {
    if (!started) return Object.freeze([]);

    const currentMs = clockValue(now);
    const runningCount = states.filter((state) => state.running).length;
    const capacity = Math.max(0, maxConcurrency - runningCount);
    if (capacity === 0) return Object.freeze([]);

    const due = states
      .filter((state) => !state.running && state.nextDueAtMs !== null && state.nextDueAtMs <= currentMs)
      .sort((left, right) => left.nextDueAtMs - right.nextDueAtMs || left.id.localeCompare(right.id))
      .slice(0, capacity);

    if (due.length === 0) {
      scheduleTimer();
      return Object.freeze([]);
    }

    const launched = due.map((state) => {
      const scheduledAtMs = state.nextDueAtMs;
      return runTask(state, scheduledAtMs);
    });
    await Promise.all(launched);
    return Object.freeze(due.map((state) => state.id));
  }

  function start({ immediate = true } = {}) {
    if (typeof immediate !== 'boolean') {
      throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_start_mode');
    }
    if (started) return false;

    const currentMs = clockValue(now);
    const intervalMs = officialSourceRefreshIntervalMs(mode);
    started = true;
    for (const state of states) {
      state.nextDueAtMs = immediate ? currentMs : currentMs + intervalMs;
    }
    emit({
      type: 'scheduler_started',
      mode,
      taskCount: states.length,
      maxConcurrency,
      immediate,
      startedAt: new Date(currentMs).toISOString(),
    });
    scheduleTimer();
    return true;
  }

  function stop() {
    if (!started) return false;
    started = false;
    clearScheduledTimer();
    emit({
      type: 'scheduler_stopped',
      stoppedAt: new Date(clockValue(now)).toISOString(),
    });
    return true;
  }

  function setMode(nextMode) {
    if (!MODES.has(nextMode)) {
      throw new OfficialSourceSchedulerError('official_source_scheduler_invalid_mode');
    }
    if (nextMode === mode) return false;

    const currentMs = clockValue(now);
    mode = nextMode;
    const cappedDueAtMs = currentMs + officialSourceRefreshIntervalMs(mode);
    for (const state of states) {
      if (!state.running && (state.nextDueAtMs === null || state.nextDueAtMs > cappedDueAtMs)) {
        state.nextDueAtMs = cappedDueAtMs;
      }
    }
    emit({
      type: 'scheduler_mode_changed',
      mode,
      changedAt: new Date(currentMs).toISOString(),
    });
    scheduleTimer();
    return true;
  }

  function snapshot() {
    const currentMs = clockValue(now);
    const publicTasks = states.map((state) => Object.freeze({
      taskId: state.id,
      running: state.running,
      nextDueAt: isoOrNull(state.nextDueAtMs),
      lastStartedAt: isoOrNull(state.lastStartedAtMs),
      lastFinishedAt: isoOrNull(state.lastFinishedAtMs),
      lastOutcome: state.lastOutcome,
      lastErrorCode: state.lastErrorCode,
      runCount: state.runCount,
    }));

    return Object.freeze({
      contract: 'OFFICIAL_SOURCE_BOUNDED_REFRESH_SCHEDULER',
      started,
      mode,
      refreshIntervalMs: officialSourceRefreshIntervalMs(mode),
      maxConcurrency,
      taskCount: states.length,
      activeCount: states.filter((state) => state.running).length,
      checkedAt: new Date(currentMs).toISOString(),
      payloadRetention: 'NONE',
      queuePolicy: 'STATIC_TASK_SET_NO_UNBOUNDED_QUEUE',
      overlapPolicy: 'PER_TASK_OVERLAP_FORBIDDEN',
      tasks: Object.freeze(publicTasks),
    });
  }

  return Object.freeze({ start, stop, setMode, tick, snapshot });
}
