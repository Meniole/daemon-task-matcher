import { Context } from "../types";
import { MatchSuggestion, PullRequestSummary } from "./types";

const MARKER = "<!-- daemon-task-matcher:suggestions -->";

export class PullRequestCommenter {
  constructor(private readonly _context: Context) {}

  async upsertSuggestions(pr: PullRequestSummary, suggestions: MatchSuggestion[], threshold: number): Promise<void> {
    const { octokit } = this._context;

    const body = this._renderBody(pr, suggestions, threshold);

    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner: pr.owner,
      repo: pr.repo,
      issue_number: pr.number,
      per_page: 100,
    });

    const existing = comments.find((c) => (c.body ?? "").includes(MARKER));
    if (existing) {
      await octokit.rest.issues.updateComment({
        owner: pr.owner,
        repo: pr.repo,
        comment_id: existing.id,
        body,
      });
      return;
    }

    await octokit.rest.issues.createComment({
      owner: pr.owner,
      repo: pr.repo,
      issue_number: pr.number,
      body,
    });
  }

  private _renderBody(pr: PullRequestSummary, suggestions: MatchSuggestion[], threshold: number): string {
    const lines: string[] = [
      MARKER,
      "### Task matcher suggestions",
      "",
      `Threshold: ${threshold.toFixed(2)}`,
      "",
      "Select one (or more) issue(s) to link:",
      "",
    ];

    for (const s of suggestions) {
      const link = `https://github.com/${s.owner}/${s.repo}/issues/${s.number}`;
      const reason = s.reason ? ` — ${s.reason}` : "";
      lines.push(`- [ ] ${s.owner}/${s.repo}#${s.number} (${s.confidence.toFixed(2)}) ${link}${reason}`);
    }

    lines.push("", `PR: https://github.com/${pr.owner}/${pr.repo}/pull/${pr.number}`);
    return lines.join("\n");
  }
}
