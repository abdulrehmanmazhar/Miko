import { randomUUID } from "node:crypto";
import { database } from "../../services/database.js";
import { pushActionContext } from "../../utils/action_recorder/index.js";
import {
  mutateTable,
  type TableMutationTaskArgs,
} from "../../utils/database/mutate_table.js";

export default async function* mutateTableTask(
  taskArgs: TableMutationTaskArgs,
): AsyncGenerator<
  { progress: number; message: string; error?: Error; data?: unknown },
  void,
  unknown
> {
  yield { progress: 0, message: `Starting ${taskArgs.operation}` };

  const operationId = randomUUID();
  pushActionContext(database, operationId, "normal");
  const result = await mutateTable(taskArgs, operationId);

  yield {
    progress: 100,
    message: `Completed ${taskArgs.operation}`,
    data: result,
  };
}
