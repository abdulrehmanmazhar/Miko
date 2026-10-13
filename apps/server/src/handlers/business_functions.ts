import { channel } from "../services/channel.js";
import { databaseTaskManager } from "../utils/task_manager/index.js";

channel?.handle("business_functions.sale", async (data: unknown) => {
  try {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error("Sale payload must be an object.");
    }

    const task = await databaseTaskManager.initiateTask("record_sale", data);
    const sale = await task.getData();
    return { success: true, ...sale };
  } catch (error) {
    return { success: false, error };
  }
});
