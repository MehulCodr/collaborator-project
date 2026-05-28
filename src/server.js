import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./db/connectDB.js";

const startServer = async () => {
  await connectDB();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
};

startServer();