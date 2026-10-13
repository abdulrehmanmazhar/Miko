import { products } from "../schema/tables.js";
import { channel } from "../services/channel.js";
import { databaseTaskManager } from "../utils/task_manager/index.js";
import { registerTableHandlers } from "./register_table_handlers.js";

registerTableHandlers("products", products, {
  eventName: "products",
  collectionKey: "products",
  excludedOperations: ["create"],
});

channel?.handle("products.create", async (data: unknown) => {
  try {
    const productTask = await databaseTaskManager.initiateTask(
      "create_product",
      {
        product: data,
        context: "normal",
      },
    );

    const product = await productTask.getData();

    return { success: true, product };
  } catch (error) {
    return { success: false, error };
  }
});
