import { units } from "../../schema/tables.js";
import { database } from "../../services/database.js";
import { pushActionContext } from "../../utils/action_recorder/index.js";

export default async function* createUnit(taksargs: {
  unit: typeof units.$inferInsert;
  context: string;
}): AsyncGenerator<
  { progress: number; message: string; error?: any; data?: unknown },
  void,
  unknown
> {
  yield { progress: 0, message: "starting creating unit" };

  pushActionContext(database, crypto.randomUUID(), taksargs.context);

  const productsArr = await database
    .insert(units)
    .values({ ...taksargs.unit })
    .returning();

  yield {
    progress: 100,
    message: `completed creating unit`,
    data: productsArr,
  };
}
