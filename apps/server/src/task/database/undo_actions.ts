import { undo } from "../../utils/action_recorder/undo.js";

export default async function* undoActions(taksargs: {
  operationId: string;
}): AsyncGenerator<
  { progress: number; message: string; error?: any; data?: unknown },
  void,
  unknown
> {
  yield { progress: 0, message: "starting undo actions" };

  const undoOperationId = await undo(taksargs.operationId);

  yield {
    progress: 100,
    message: `completed undo actions`,
    data: { undoOperationId },
  };
}
