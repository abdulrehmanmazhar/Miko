export default async () => {
  type ProcessMessage = {
    type?: string;
    module?: string;
    args?: unknown;
    error?: Error;
    value?: unknown;
  };

  let gen: AsyncGenerator<unknown, unknown, unknown> | undefined;

  process.on("message", async (command: ProcessMessage) => {
    try {
      switch (command?.type) {
        case "init": {
        if (typeof command.module !== "string" || !("args" in command)) {
          throw new Error("Invalid child process initialization message");
        }

        const generatorFactory = new Function(
          `return ${command.module}`,
        )() as (args: unknown) => AsyncGenerator<unknown, unknown, unknown>;
        gen = generatorFactory(command.args);
        break;
        }

        case "next": {
        if (!gen) throw new Error("Child process has not been initialized");
        const result = await gen.next();
        process.send?.({ type: "result", ...result });
        if (result.done) process.send?.({ type: "done" });
        if (
          result.value !== null &&
          typeof result.value === "object" &&
          "error" in result.value &&
          result.value.error
        ) {
          const error = result.value.error;
          process.send?.({
            type: "error",
            error:
              error instanceof Error ? error.message : String(error),
          });
        }
        break;
        }

        case "throw": {
        if (!gen) throw new Error("Child process has not been initialized");
        const { value, done } = await gen.throw(command.error);
        process.send?.({ type: "result", value, done });
        if (done) process.send?.({ type: "done" });
        break;
        }

        case "return": {
        if (!gen) throw new Error("Child process has not been initialized");
        const { value, done } = await gen.return(command.value);
        process.send?.({ type: "done", value, done });
        break;
        }

        default:
        process.send?.({
          type: "error",
          error: `Unknown command: ${command?.type}`,
        });
      }
    } catch (err) {
      process.send?.({
        type: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
};
