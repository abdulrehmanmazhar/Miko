import { actionRecords } from "../schema/tables.js";
import { channel } from "../services/channel.js";
import { isPaginationData } from "../types/schema.js";
import { getPaginatedTable } from "../utils/database/get_paginated_table.js";
import { databaseTaskManager } from "../utils/task_manager/index.js";

channel?.handle("action_records.get", async (data: unknown) => {
  try {
    if (!isPaginationData(data))
      throw new Error("Payload does not contain pagination data");
    const pageNumber = data.pageNumber;
    const totalRows = data.rowsPerPage;
    const productRes = await getPaginatedTable(
      actionRecords,
      pageNumber,
      totalRows,
    );
    return { success: true, products: productRes };
  } catch (error) {
    return { success: false, error };
  }
});

channel?.handle("action_records.undo", async (data: unknown) => {
  try {
    if (
      !(
        typeof data === "object" &&
        data !== null &&
        "operationId" in data &&
        typeof data.operationId === "string"
      )
    )
      throw new Error("Payload does not contain operationId");
    const undoTask = await databaseTaskManager.initiateTask("undo_actions", {
      operationId: data.operationId,
    });

    const undoData = await undoTask.getData();
    return { success: true, operationId: undoData.undoOperationId };
  } catch (error) {
    return { success: false, error };
  }
});

channel?.handle("action_records.redo", async (data: unknown) => {
  try {
    if (
      !(
        typeof data === "object" &&
        data !== null &&
        "operationId" in data &&
        typeof data.operationId === "string"
      )
    )
      throw new Error("Payload does not contain operationId");
    const redoTask = await databaseTaskManager.initiateTask("redo_actions", {
      operationId: data.operationId,
    });

    const redoData = await redoTask.getData();
    return { success: true, operationId: redoData.redoOperationId };
  } catch (error) {
    return { success: false, error };
  }
});
