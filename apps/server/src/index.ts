import { connectDatabase } from "./services/database.js";
import { databaseTaskManager } from "./utils/task_manager/index.js";

(async () => {
  connectDatabase();
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
