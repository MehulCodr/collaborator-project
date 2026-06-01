import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import { notFound } from "./middlewares/notFound.middleware.js";
import projectRoutes from "./routes/project.routes.js";
import taskRoutes from "./routes/task.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import attachmentRoutes from "./routes/attachment.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import githubRoutes from "./routes/github.routes.js";
import aiRoutes from "./routes/ai.routes.js";

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
app.use(limiter);
app.use("/uploads", express.static("uploads"));

app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", projectRoutes);
app.use("/api/v1", taskRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1", commentRoutes);
app.use("/api/v1", attachmentRoutes);
app.use("/api/v1/organizations", organizationRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/github", githubRoutes);
app.use("/api/v1/analytics", analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;