import { Router } from "express";
import {
  connectRepositoryToProject,
  getGithubRepositories,
  getGithubStatus,
  getProjectGithubRepositories,
  getRepositoryIssues,
  getRepositoryPulls,
  handleGithubCallback,
  startGithubOAuth
} from "../controllers/github.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireProjectAccess } from "../middlewares/project.middleware.js";

const router = Router();

router.get("/callback", handleGithubCallback);

router.use(verifyJWT);

router.get("/connect", startGithubOAuth);
router.get("/status", getGithubStatus);
router.get("/repositories", getGithubRepositories);

router.post(
  "/projects/:projectId/repositories",
  requireProjectAccess({
    orgRoles: ["owner", "admin"],
    projectRoles: ["manager"]
  }),
  connectRepositoryToProject
);

router.get(
  "/projects/:projectId/repositories",
  requireProjectAccess({
    orgRoles: ["owner", "admin", "member", "viewer"],
    projectRoles: ["manager", "developer", "viewer"]
  }),
  getProjectGithubRepositories
);

router.get("/repositories/:repositoryId/issues", getRepositoryIssues);
router.get("/repositories/:repositoryId/pulls", getRepositoryPulls);

export default router;