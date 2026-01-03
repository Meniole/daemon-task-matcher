import { Context } from "../types";
import { PullRequestDiff } from "./types";

export class PullRequestDiffFetcher {
  constructor(private readonly _context: Context) {}

  async fetchDiff(owner: string, repo: string, pullNumber: number): Promise<PullRequestDiff> {
    const files = await this._context.octokit.paginate(this._context.octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    const parts: string[] = [];
    const structured = files.map((f) => {
      const patch = f.patch ?? undefined;
      if (patch) {
        parts.push(`file: ${f.filename}\n${patch}`);
      } else {
        parts.push(`file: ${f.filename}`);
      }
      return { filename: f.filename, patch };
    });

    const text = parts.join("\n\n");
    return { files: structured, text };
  }
}
