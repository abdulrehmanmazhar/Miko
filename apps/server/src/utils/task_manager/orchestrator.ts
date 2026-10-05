import { Worker } from "node:worker_threads";
import type { TTaskIntensity } from "../../types/task_manager.js";
import { getModuleURL } from "../paths/index.js";
import { fork } from "node:child_process";

async function runInMainThread<T>(
  fn: string,
  args: any[],
): Promise<AsyncGenerator<T>> {
  try {
    const module = await import(fn);
    const generatorFunction = module.default;
    if (typeof generatorFunction !== "function") {
      throw new Error("Default export must be an async generator function");
    }
    const result = generatorFunction(args);
    return result;
  } catch (err) {
    throw err;
  }
}

function runInChildProcess(modulePath: string, args: any, cleanup: () => void) {
  const childPath = getModuleURL("./process.js", import.meta.url);
  const child = fork(childPath, [], {
    stdio: ["inherit", "inherit", "inherit", "ipc"], // enable IPC
    env: process.env,
  });

  // Send module info
  child.send({ modulePath, args });

  let pendingResolve: any = null;
  let pendingReject: any = null;
  let isDone = false;
  let isCanceled = false;
  let lastResult = { value: undefined, done: false };

  const waitForResponse = () =>
    new Promise((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
    });

  child.on("message", (msg: any) => {
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "result":
        lastResult = { value: msg.value, done: !!msg.done };
        pendingResolve?.(lastResult);
        pendingResolve = pendingReject = null;
        break;

      case "done":
        isDone = true;
        pendingResolve?.({ value: msg.value, done: true });
        cleanup?.();
        terminateChild();
        break;

      case "error":
        const err = new Error(msg.error || "Unknown child process error");
        pendingReject?.(err);
        cleanup?.();
        terminateChild();
        console.log("child message error");
        break;

      default:
        console.warn("[ChildProcess] Unknown message:", msg);
    }
  });

  child.on("error", (err) => {
    pendingReject?.(err);
    cleanup?.();
    terminateChild();
    console.log("child error");
  });

  child.on("exit", (code) => {
    if (!isDone && code !== 0 && !isCanceled) {
      const err = new Error(`Child process exited with code ${code}`);
      pendingReject?.(err);
      cleanup?.();
    }
    terminateChild();
    console.log("child exit");
  });

  /** Graceful termination */
  function terminateChild() {
    if (!isDone && !isCanceled) {
      isCanceled = true;
      isDone = true;
    }
    try {
      console.log("Kiling child process");
      child.kill();
    } catch {
      console.log("Could not kill child process");
    }
  }

  /** Cancel callback for external control */
  const cancel = () => {
    isCanceled = true;
    child.send({ type: "return" });
    terminateChild();
  };

  /** Iterator-style next() */
  async function next() {
    if (isDone || isCanceled) return { value: undefined, done: true };

    child.send({ type: "next" });

    try {
      const result: any = await waitForResponse();
      if (result.done) {
        isDone = true;
        terminateChild();
      }
      return result;
    } catch (err) {
      terminateChild();
      throw err;
    }
  }

  /** Optional throw() for generator error injection */
  async function throwError(error: Error) {
    if (isDone || isCanceled)
      throw new Error("Cannot throw into a finished or canceled child process");

    child.send({ type: "throw", error });
    return waitForResponse();
  }

  /** Optional return() for graceful early finish */
  async function finish(value: any) {
    if (isDone || isCanceled) return { done: true };
    child.send({ type: "return", value });
    return waitForResponse();
  }

  return {
    next,
    throw: throwError,
    return: finish,
    cancel,
    [Symbol.asyncIterator]() {
      return { next };
    },
  };
}

function runInWorkerThread(modulePath: string, args: any, cleanup: () => void) {
  const worker = new Worker(getModuleURL("./worker.js", import.meta.url), {
    workerData: { modulePath, args },
  });

  let pendingResolve: any = null;
  let pendingReject: any = null;
  let isDone = false;
  let isCanceled = false;
  let lastResult = { value: undefined, done: false };

  // Promise that resolves when worker replies
  const waitForResponse = () =>
    new Promise((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
    });

  worker.on("message", (msg) => {
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "result":
        lastResult = { value: msg.value, done: !!msg.done };
        pendingResolve?.(lastResult);
        pendingResolve = pendingReject = null;
        break;

      case "done":
        isDone = true;
        pendingResolve?.({ value: msg.value, done: true });
        cleanup?.();
        terminateWorker();
        break;

      case "error":
        const err = new Error(msg.error || "Unknown worker error");
        pendingReject?.(err);
        cleanup?.();
        terminateWorker();
        break;

      default:
        console.warn("[Worker] Unknown message:", msg);
    }
  });

  worker.on("error", (err) => {
    pendingReject?.(err);
    cleanup?.();
    terminateWorker();
  });

  worker.on("exit", (code) => {
    if (!isDone && code !== 0 && !isCanceled) {
      const err = new Error(`Worker exited with code ${code}`);
      pendingReject?.(err);
      cleanup?.();
    }
    terminateWorker();
  });

  /** Gracefully terminates the worker */
  function terminateWorker() {
    if (!isDone && !isCanceled) {
      isCanceled = true;
      isDone = true;
    }
    console.log("killing worker");
    worker.terminate().catch(() => {
      console.log("Could not kill worker");
    });
  }

  /** Cancel callback for external control */
  const cancel = () => {
    isCanceled = true;
    worker.postMessage({ type: "return" });
    terminateWorker();
  };

  /** Iterator-style next() */
  async function next() {
    if (isDone || isCanceled) {
      return { value: undefined, done: true };
    }

    worker.postMessage({ type: "next" });

    try {
      const result: any = await waitForResponse();
      if (result.done) {
        isDone = true;
        terminateWorker();
      }
      return result;
    } catch (err) {
      terminateWorker();
      throw err;
    }
  }

  /** Optional throw() to inject errors into the generator */
  async function throwError(error: Error) {
    if (isDone || isCanceled) {
      throw new Error("Cannot throw into a finished or canceled worker");
    }

    worker.postMessage({ type: "throw", error });
    return waitForResponse();
  }

  /** Optional return() to gracefully finish early */
  async function finish(value: any) {
    if (isDone || isCanceled) return { done: true };
    worker.postMessage({ type: "return", value });
    return waitForResponse();
  }

  return {
    next,
    throw: throwError,
    return: finish,
    cancel,
    [Symbol.asyncIterator]() {
      return { next };
    },
  };
}

export const taskRunner = async (
  modulePath: string,
  args: any,
  mode: TTaskIntensity = "medium",
) => {
  if (mode === "low") {
    const result = await runInMainThread(modulePath, args);
    return result;
  } else if (mode === "medium") {
    const result = runInWorkerThread(modulePath, args, () => {});
    return result;
  } else if (mode === "high") {
    return runInChildProcess(modulePath, args, () => {});
  }
};
