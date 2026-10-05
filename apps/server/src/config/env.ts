try {
  process.loadEnvFile();
} catch {
  console.log("didn't find any .env file");
}

export default {
  NODE_ENV: process.env.NODE_ENV || ("PRODUCTION" as const),
  APP_NAME: "Miko",
};
