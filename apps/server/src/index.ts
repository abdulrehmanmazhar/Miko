import { createChannel } from "./services/channel.js";
import { connectDatabase } from "./services/database.js";
import { readAuth, registerExtensionLifecycle } from "./services/lifecycle.js";
import { log } from "./services/logger.js";
import { connectNeutralinoTransport } from "./services/transport.js";
import { databaseTaskManager } from "./utils/task_manager/index.js";
(async () => {
  connectDatabase();

  const auth = readAuth();

  const transport = connectNeutralinoTransport(auth, log);

  const channel = createChannel(transport);

  await import("./handlers/index.js");

  channel.start();

  registerExtensionLifecycle(channel, transport, {
    exitCode: 1,
    log: (msg, type = "INFO") =>
      log(type.toLowerCase() as "error" | "info", msg),
  });

  const unitTask = await databaseTaskManager.initiateTask("create_table_row", {
    tableName: "categories",
    operation: "create",
    values: { name: "cat", for: "inventory" },
  });

  log("info", "Unit task data", { data: await unitTask.getData() });

  // const currencyTask = await databaseTaskManager.initiateTask(
  //   "create_currency",
  //   {
  //     currency: { symbol: "PKR", name: "PKR" },
  //     context: "normal",
  //   },
  // );

  // log("info", "Currency task data", { data: await currencyTask.getData() });
})().catch((err) => {
  log("error", "Unexpected error in main thread", { err });
  process.exit(1);
});
