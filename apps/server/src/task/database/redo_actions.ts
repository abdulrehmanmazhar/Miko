import { redo } from "../../utils/action_recorder/redo.js";

export default async function* redoActions(taksargs: {
  operationId: string;
}): AsyncGenerator<
  { progress: number; message: string; error?: any; data?: unknown },
  void,
  unknown
> {
  yield { progress: 0, message: "starting redo actions" };

  const redoOperationId = await redo(taksargs.operationId);

  yield {
    progress: 100,
    message: `completed redo actions`,
    data: { redoOperationId },
  };
}
