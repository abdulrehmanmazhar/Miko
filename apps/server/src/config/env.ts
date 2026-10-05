process.loadEnvFile();

export default {
  NODE_ENV: process.env.NODE_ENV || ("PRODUCTION" as const),
  APP_NAME: "Miko",
};
