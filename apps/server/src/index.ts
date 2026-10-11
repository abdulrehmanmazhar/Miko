import { Channel } from "./protocol/channel.js";
import { connectDatabase } from "./services/database.js";
import { readAuth, registerExtensionLifecycle } from "./services/lifecycle.js";
import { log } from "./services/logger.js";
import { connectNeutralinoTransport } from "./services/transport.js";
import { databaseTaskManager } from "./utils/task_manager/index.js";

(async () => {
  connectDatabase();
  const auth = readAuth();
  const transport = connectNeutralinoTransport(auth);

  const channel = new Channel(transport);
  channel.start();

  registerExtensionLifecycle(channel, transport, {
    exitCode: 1,
    log: (msg, type = "INFO") =>
      log(type.toLowerCase() as "error" | "info", msg),
  });

  const unitTask = await databaseTaskManager.initiateTask("create_unit", {
    unit: { name: "kilos" },
    context: "normal",
  });
  console.log(await unitTask.getData());

  const currencyTask = await databaseTaskManager.initiateTask(
    "create_currency",
    {
      currency: { symbol: "PKR", name: "PKR" },
      context: "normal",
    },
  );

  console.log(await currencyTask.getData());

  const getActionsTask = await databaseTaskManager.initiateTask(
    "get_actions",
    {},
    { intensity: "high" },
  );

  console.log(await getActionsTask.getData());
})().catch(console.error);

console.log("hello");
