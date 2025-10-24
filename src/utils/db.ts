import { drizzle } from 'drizzle-orm/neon-http';
import { eq, inArray, and } from 'drizzle-orm';
import { checkRuns } from '../db/schema.js';

export class DatabaseAPI {
  private db;

  constructor() {
    this.db = drizzle(process.env.DATABASE_URL!);
  }

  // Create a new check run
  async createCheckRun(params: {
    owner: string;
    repo: string;
    checkRunId: number;
    headSHA: string;
  }) {
    const dateCreated = new Date();

    const run: typeof checkRuns.$inferInsert = {
      owner: params.owner,
      repo: params.repo,
      checkRunId: params.checkRunId,
      headSHA: params.headSHA,
      status: 'queued',
      dateCreated: dateCreated.toISOString(),
    };

    return await this.db.insert(checkRuns).values(run).returning();
  }

  // Get all queued checks for a specific repo/headSHA
  async getQueuedChecks(owner: string, repo: string, headSHA: string) {
    return await this.db
      .select()
      .from(checkRuns)
      .where(
        and(
          eq(checkRuns.owner, owner),
          eq(checkRuns.repo, repo),
          eq(checkRuns.headSHA, headSHA),
          eq(checkRuns.status, 'queued')
        )
      );
  }

  // Get all checks that are either queued or in_progress
  async getActiveChecks(owner: string, repo: string, headSHA: string) {
    return await this.db
      .select()
      .from(checkRuns)
      .where(
        and(
          eq(checkRuns.owner, owner),
          eq(checkRuns.repo, repo),
          eq(checkRuns.headSHA, headSHA),
          inArray(checkRuns.status, ['queued', 'in_progress'])
        )
      );
  }

  // Update a single check run
  async updateCheckRunStatus(
    checkRunId: number,
    status: string,
    conclusion?: string
  ) {
    return await this.db
      .update(checkRuns)
      .set({ status, conclusion })
      .where(eq(checkRuns.checkRunId, checkRunId))
      .returning();
  }

  // Batch update multiple check runs atomically
  async updateMultipleCheckRunsStatus(
    checkRunIds: number[],
    status: string,
    conclusion?: string
  ) {
    return await this.db
      .update(checkRuns)
      .set({ status, conclusion })
      .where(inArray(checkRuns.checkRunId, checkRunIds))
      .returning();
  }
}
