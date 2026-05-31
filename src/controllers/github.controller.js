import crypto from "crypto";
import { GithubConnection } from "../models/githubConnection.model.js";
import { GithubRepository } from "../models/githubRepository.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateMongoId } from "../utils/validateMongoId.js";
import { encryptText, decryptText } from "../utils/crypto.js";
import { env } from "../config/env.js";
import {
  exchangeCodeForAccessToken,
  getAuthenticatedGithubRepos,
  getAuthenticatedGithubUser,
  getGithubRepoByFullName,
  getGithubRepoIssues,
  getGithubRepoPulls
} from "../services/github.service.js";

const oauthCookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: env.nodeEnv === "production" ? "none" : "lax",
  maxAge: 10 * 60 * 1000
};

const getGithubTokenForUser = async (userId) => {
  const connection = await GithubConnection.findOne({
    user: userId
  }).select("+accessTokenEncrypted");

  if (!connection) {
    throw new ApiError(400, "GitHub account is not connected");
  }

  return {
    connection,
    token: decryptText(connection.accessTokenEncrypted)
  };
};

export const startGithubOAuth = asyncHandler(async (req, res) => {
  const state = crypto.randomBytes(24).toString("hex");

  const scopes = ["repo", "read:user", "user:email"].join(" ");

  const authorizationUrl = new URL("https://github.com/login/oauth/authorize");

  authorizationUrl.searchParams.set("client_id", env.githubClientId);
  authorizationUrl.searchParams.set("redirect_uri", env.githubCallbackUrl);
  authorizationUrl.searchParams.set("scope", scopes);
  authorizationUrl.searchParams.set("state", state);

  return res
    .cookie("githubOAuthState", state, oauthCookieOptions)
    .cookie("githubOAuthUserId", req.user._id.toString(), oauthCookieOptions)
    .redirect(authorizationUrl.toString());
});

export const handleGithubCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    throw new ApiError(400, "GitHub code and state are required");
  }

  const savedState = req.cookies?.githubOAuthState;
  const userId = req.cookies?.githubOAuthUserId;

  if (!savedState || !userId || savedState !== state) {
    throw new ApiError(400, "Invalid GitHub OAuth state");
  }

  const { accessToken, scope } = await exchangeCodeForAccessToken(code);

  const githubUser = await getAuthenticatedGithubUser(accessToken);

  await GithubConnection.findOneAndUpdate(
    {
      user: userId
    },
    {
      $set: {
        githubUserId: githubUser.id,
        username: githubUser.login,
        displayName: githubUser.name || "",
        avatarUrl: githubUser.avatar_url || "",
        profileUrl: githubUser.html_url || "",
        accessTokenEncrypted: encryptText(accessToken),
        scopes: scope ? scope.split(",").map((item) => item.trim()) : [],
        connectedAt: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      runValidators: true
    }
  );

  return res
    .clearCookie("githubOAuthState", oauthCookieOptions)
    .clearCookie("githubOAuthUserId", oauthCookieOptions)
    .redirect(`${env.frontendUrl}/dashboard?github=connected`);
});

export const getGithubStatus = asyncHandler(async (req, res) => {
  const connection = await GithubConnection.findOne({
    user: req.user._id
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        connected: Boolean(connection),
        connection: connection
          ? {
              username: connection.username,
              displayName: connection.displayName,
              avatarUrl: connection.avatarUrl,
              profileUrl: connection.profileUrl,
              connectedAt: connection.connectedAt,
              scopes: connection.scopes
            }
          : null
      },
      "GitHub status fetched successfully"
    )
  );
});

export const getGithubRepositories = asyncHandler(async (req, res) => {
  const { token } = await getGithubTokenForUser(req.user._id);

  const repos = await getAuthenticatedGithubRepos(token);

  const formattedRepos = repos.map((repo) => ({
    githubRepoId: repo.id,
    fullName: repo.full_name,
    owner: repo.owner?.login,
    name: repo.name,
    private: repo.private,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch,
    description: repo.description,
    language: repo.language,
    updatedAt: repo.updated_at
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { repositories: formattedRepos }, "GitHub repositories fetched successfully"));
});

export const connectRepositoryToProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { fullName } = req.body;

  validateMongoId(projectId, "project id");

  if (!fullName?.trim() || !fullName.includes("/")) {
    throw new ApiError(400, "Repository fullName is required, for example owner/repo");
  }

  const { connection, token } = await getGithubTokenForUser(req.user._id);

  const repo = await getGithubRepoByFullName({
    token,
    fullName
  });

  const repository = await GithubRepository.findOneAndUpdate(
    {
      project: req.project._id,
      githubRepoId: repo.id
    },
    {
      $set: {
        organization: req.project.organization,
        project: req.project._id,
        connection: connection._id,
        connectedBy: req.user._id,
        githubRepoId: repo.id,
        fullName: repo.full_name,
        owner: repo.owner.login,
        name: repo.name,
        private: repo.private,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch || "main"
      }
    },
    {
      upsert: true,
      new: true,
      runValidators: true
    }
  );

  return res
    .status(201)
    .json(new ApiResponse(201, { repository }, "Repository connected to project successfully"));
});

export const getProjectGithubRepositories = asyncHandler(async (req, res) => {
  const repositories = await GithubRepository.find({
    project: req.project._id
  })
    .populate("connectedBy", "name email avatar")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, { repositories }, "Project GitHub repositories fetched successfully"));
});

export const getRepositoryIssues = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;

  validateMongoId(repositoryId, "repository id");

  const repository = await GithubRepository.findById(repositoryId);

  if (!repository) {
    throw new ApiError(404, "GitHub repository not found");
  }

  const { token } = await getGithubTokenForUser(req.user._id);

  const issues = await getGithubRepoIssues({
    token,
    owner: repository.owner,
    repo: repository.name
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { issues }, "GitHub issues fetched successfully"));
});

export const getRepositoryPulls = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;

  validateMongoId(repositoryId, "repository id");

  const repository = await GithubRepository.findById(repositoryId);

  if (!repository) {
    throw new ApiError(404, "GitHub repository not found");
  }

  const { token } = await getGithubTokenForUser(req.user._id);

  const pulls = await getGithubRepoPulls({
    token,
    owner: repository.owner,
    repo: repository.name
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { pulls }, "GitHub pull requests fetched successfully"));
});