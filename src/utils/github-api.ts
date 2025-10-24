import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

export class GitHubAPI {
  private appId: number;
  private privateKey: string;
  private appOctokit: Octokit;
  private installationClients = new Map<number, Octokit>();

  /**
   * Create a GitHubAPI instance.
   * If appId or privateKey are omitted, values are taken from GITHUB_APP_ID and GITHUB_PRIVATE_KEY env vars.
   */
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

  /**
   * Post a comment on a pull request or issue as the GitHub App installation.
   *
   * @param owner repo owner login (payload.repository.owner.login)
   * @param repo repo name (payload.repository.name)
   * @param number pull request or issue number
   * @param body markdown body of the comment
   */
  async postComment(owner: string, repo: string, number: number, body: string) {
    const { data: installation } = await this.appOctokit.rest.apps.getRepoInstallation({
      owner,
      repo,
    });

    const installationOctokit = this.getInstallationClient(installation.id);

    const res = await installationOctokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body,
    });

    return res.data;
  }
}
