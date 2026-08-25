/**
 * A small pool of analysis workers.
 *
 * Previously a single worker served all requests, so fetching at concurrency 3
 * just queued three decodes behind one serialised ~350ms analysis. Sizing the
 * pool to the machine turns import time from roughly linear into roughly
 * linear-over-cores.
 *
 * Workers are created lazily on first use and torn down when idle, because the
 * Essentia WASM module is ~2.5 MB per instance.
 */
const MAX_WORKERS = 4;

export function createWorkerPool(factory, { size } = {}) {
  const target =
    size ?? Math.max(1, Math.min(MAX_WORKERS, (navigator.hardwareConcurrency || 4) - 1));

  const workers = [];
  const idle = [];
  const queue = [];
  let nextJobId = 0;

  function spawn() {
    const worker = factory();
    const entry = { worker, pending: new Map() };
    worker.onmessage = ({ data }) => {
      const job = entry.pending.get(data.id);
      if (!job) return;
      entry.pending.delete(data.id);
      if (data.ok) job.resolve(data.result);
      else job.reject(new Error(data.error));
      release(entry);
    };
    worker.onerror = (event) => {
      entry.pending.forEach((job) => job.reject(new Error(event.message || 'worker error')));
      entry.pending.clear();
      release(entry);
    };
    workers.push(entry);
    return entry;
  }

  function release(entry) {
    const next = queue.shift();
    if (next) run(entry, next);
    else idle.push(entry);
  }

  function run(entry, job) {
    entry.pending.set(job.id, job);
    entry.worker.postMessage({ id: job.id, ...job.payload }, job.transfer);
  }

  function submit(payload, transfer = []) {
    return new Promise((resolve, reject) => {
      const job = { id: (nextJobId += 1), payload, transfer, resolve, reject };
      const entry = idle.pop() || (workers.length < target ? spawn() : null);
      if (entry) run(entry, job);
      else queue.push(job);
    });
  }

  function terminate() {
    workers.forEach((entry) => {
      entry.pending.forEach((job) => job.reject(new Error('pool terminated')));
      entry.worker.terminate();
    });
    workers.length = 0;
    idle.length = 0;
    queue.length = 0;
  }

  return { submit, terminate, get size() { return workers.length; }, target };
}
