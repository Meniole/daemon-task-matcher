import { Context } from "../types/index";
import { IssueSummary, RepoRef } from "./types";

export type IssueFinderConfig = {
  requirePriceLabel: boolean;
};

const PRICE_LABEL_REGEX = /^Price:\s*\d+(?:\.\d+)?\s*[A-Za-z]{2,10}$/;

export class UnassignedPricedIssueFinder {
  constructor(
    private readonly _context: Context,
    private readonly _config: IssueFinderConfig
  ) {}

  async listOpenUnassignedIssues(repos: RepoRef[]): Promise<IssueSummary[]> {
    const allIssues: IssueSummary[] = [];
    for (const repo of repos) {
      const issues = await this._context.octokit.paginate(this._context.octokit.rest.issues.listForRepo, {
        owner: repo.owner,
        repo: repo.repo,
        state: "open",
        per_page: 100,
        assignee: "none",
      });

      for (const issue of issues) {
        const issueSummary = this._toCandidateIssue(repo.owner, repo.repo, issue);
        if (!issueSummary) continue;
        allIssues.push(issueSummary);
      }
    }

    return allIssues;
  }

  private _toCandidateIssue(owner: string, repo: string, issue: unknown): IssueSummary | null {
    const i = issue as {
      pull_request?: unknown;
      number: number;
      title?: string | null;
      body?: string | null;
      html_url?: string | null;
      labels?: Array<string | { name?: string | null }> | null;
      assignees?: unknown[] | null;
    };

    if (i.pull_request) return null;

    const labels = (i.labels ?? []).map((l) => (typeof l === "string" ? l : (l?.name ?? ""))).filter((v) => v.length > 0);

    if (this._config.requirePriceLabel) {
      if (!labels.some((l) => PRICE_LABEL_REGEX.test(l))) return null;
    }

    const assignees = i.assignees ?? [];
    if (assignees.length > 0) return null;

    return {
      owner,
      repo,
      number: i.number,
      title: i.title ?? "",
      body: i.body ?? "",
      url: i.html_url ?? "",
      labels,
    };
  }
}
