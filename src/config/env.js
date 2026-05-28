import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = ["PORT", "MONGODB_URI", "CORS_ORIGIN"];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: process.env.PORT,
  mongoUri: process.env.MONGODB_URI,
  corsOrigin: process.env.CORS_ORIGIN
};