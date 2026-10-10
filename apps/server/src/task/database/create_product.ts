import { products } from "../../schema/tables.js";
import { database } from "../../services/database.js";
import { pushActionContext } from "../../utils/action_recorder/index.js";

export default async function* createProduct(taksargs: {
  product: typeof products.$inferInsert;
  context: string;
}): AsyncGenerator<
  { progress: number; message: string; error?: any; data?: unknown },
  void,
  unknown
> {
  yield { progress: 0, message: "starting creating product" };

  pushActionContext(database, crypto.randomUUID(), taksargs.context);

  const productsArr = await database
    .insert(products)
    .values({ ...taksargs.product })
    .returning();

  yield {
    progress: 100,
    message: `completed creating product`,
    data: productsArr,
  };
}
