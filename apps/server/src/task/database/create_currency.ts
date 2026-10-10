import { currencies } from "../../schema/tables.js";
import { database } from "../../services/database.js";
import { pushActionContext } from "../../utils/action_recorder/index.js";

export default async function* createCurrency(taksargs: {
  currency: typeof currencies.$inferInsert;
  context: string;
}): AsyncGenerator<
  { progress: number; message: string; error?: any; data?: unknown },
  void,
  unknown
> {
  yield { progress: 0, message: "starting creating currency" };

  pushActionContext(database, crypto.randomUUID(), taksargs.context);

  const productsArr = await database
    .insert(currencies)
    .values({ ...taksargs.currency })
    .returning();

  yield {
    progress: 100,
    message: `completed creating currency`,
    data: productsArr,
  };
}
