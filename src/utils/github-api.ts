import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { DatabaseAPI } from "./db.js";

export class GitHubAPI {
  private appId: number;
  private privateKey: string;
  private appOctokit: Octokit;
  private installationClients = new Map<number, Octokit>();
  private db: DatabaseAPI;

  constructor(options?: { appId?: number | string; privateKey?: string }) {
    const APP_ID = options?.appId ?? process.env.GITHUB_APP_ID;
    const RAW_PRIVATE_KEY = options?.privateKey ?? process.env.GITHUB_PRIVATE_KEY;

    if (!APP_ID) throw new Error("GITHUB_APP_ID required");
    if (!RAW_PRIVATE_KEY) throw new Error("GITHUB_PRIVATE_KEY required");

    this.appId = Number(APP_ID);
    this.privateKey = RAW_PRIVATE_KEY.replace(/\\n/g, "\n");

    this.appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId,
        privateKey: this.privateKey,
      },
    });

    this.db = new DatabaseAPI();
  }

  private getInstallationClient(installationId: number) {
    const cached = this.installationClients.get(installationId);
    if (cached) return cached;

    const client = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId,
        privateKey: this.privateKey,
        installationId,
      },
    });

    this.installationClients.set(installationId, client);
    return client;
  }

  private async getOctokitForRepo(owner: string, repo: string) {
    const { data: installation } = await this.appOctokit.rest.apps.getRepoInstallation({
      owner,
      repo,
    });
    return this.getInstallationClient(installation.id);
  }

  async postComment(owner: string, repo: string, number: number, body: string) {
    const installationOctokit = await this.getOctokitForRepo(owner, repo);
    const res = await installationOctokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body,
    });
    return res.data;
  }

  async queueCheck(owner: string, repo: string, name: string, headSHA: string) {
    const installationOctokit = await this.getOctokitForRepo(owner, repo);
    const res = await installationOctokit.rest.checks.create({
      owner,
      repo,
      name,
      head_sha: headSHA,
      status: 'queued',
    });

    await this.db.createCheckRun({
      owner,
      repo,
      checkRunId: res.data.id,
      headSHA,
    });
  }

  async startAllChecks(owner: string, repo: string, headSHA: string) {
    const installationOctokit = await this.getOctokitForRepo(owner, repo);

    const queuedChecks = await this.db.getQueuedChecks(owner, repo, headSHA);

    await Promise.all(queuedChecks.map(async (check) => {
      const now = new Date().toISOString();
      await installationOctokit.rest.checks.update({
        owner,
        repo,
        check_run_id: check.checkRunId,
        status: 'in_progress',
        started_at: now,
      });
    }));

    // Batch update in DB
    const ids = queuedChecks.map(c => c.checkRunId);
    if (ids.length > 0) {
      await this.db.updateMultipleCheckRunsStatus(ids, 'in_progress');
    }
  }

  async completeAllChecks(
    owner: string,
    repo: string,
    headSHA: string,
    conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required',
  ) {
    const installationOctokit = await this.getOctokitForRepo(owner, repo);

    const activeChecks = await this.db.getActiveChecks(owner, repo, headSHA);

    await Promise.all(activeChecks.map(async (check) => {
      const now = new Date().toISOString();
      await installationOctokit.rest.checks.update({
        owner,
        repo,
        check_run_id: check.checkRunId,
        status: 'completed',
        completed_at: now,
        conclusion,
      });
    }));

    // Batch update in DB
    const ids = activeChecks.map(c => c.checkRunId);
    if (ids.length > 0) {
      await this.db.updateMultipleCheckRunsStatus(ids, 'completed', conclusion);
    }
  }
}
