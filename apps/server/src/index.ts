// import { actionRecords, users } from "./schema/tables.js";
// import { connectDatabase, database } from "./services/database.js";
// import { pushActionContext } from "./utils/action_recorder/index.js";
// (async () => {
//   connectDatabase();
//   let records = await database.select().from(actionRecords);

//   console.log({ records });

//   pushActionContext(database, crypto.randomUUID(), "normal");

//   const user = await database
//   .insert(users)
//   .values([{ name: "Abdur Rahman" }, { name: "Abdullah" }])
//   .returning();

//   console.log(user);

//   records = await database.select().from(actionRecords);

//   console.log({ records });
// })().catch(console.error);

console.log("hello");
