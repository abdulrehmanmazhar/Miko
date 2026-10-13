export default async () => {
  const { parentPort, workerData, isMainThread } =
    await import("node:worker_threads");

  const { module, args } = workerData;
  let isCanceled = false;
  let isPaused = false;
  // Listen early to avoid race conditions
  parentPort?.on("message", (flags) => {
    isCanceled = !!flags.isCanceled;
    isPaused = !!flags.isPaused;
  });

  try {
    const generatorFn = new Function(`return ${module}`);
    // console.log(isMainThread);

    if (typeof generatorFn !== "function") {
      throw new Error("Default export must be an async generator function");
    }

    const gen = generatorFn()(args);

    parentPort?.on("message", async (msg) => {
      try {
        switch (msg?.type) {
          case "next": {
            const result = await gen.next();
            const { value, done } = result;
            parentPort?.postMessage({
              type: "result",
              value: result.value,
              done: result.done,
            });
            if (done) {
              parentPort?.postMessage({ type: "done" });
            }

            if (value.error) {
              parentPort?.postMessage({
                type: "error",
                error: value.error?.message || String(value.error),
              });
            }
            break;
          }

          case "throw": {
            const { error } = msg;
            const { value, done } = await gen.throw(error);
            parentPort?.postMessage({ type: "result", value, done });
            break;
          }

          case "return": {
            const { value } = msg;
            const { done } = await gen.return(value);
            parentPort?.postMessage({ type: "done", value, done });
            break;
          }

          default:
            parentPort?.postMessage({
              type: "error",
              error: `Unknown command: ${msg?.type}`,
            });
        }
      } catch (err: Error | any) {
        parentPort?.postMessage({
          type: "error",
          error: err?.message || String(err),
        });
      }
    });
  } catch (err: Error | any) {
    parentPort?.postMessage({
      type: "error",
      error: err?.message || String(err),
    });
  }
};
