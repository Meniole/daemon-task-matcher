import { Context } from "../types/index";
import { RepoRef } from "./types";

export class InstallationRepoLister {
  constructor(private readonly _context: Context) {}

  async listRepos(): Promise<RepoRef[]> {
    const { octokit } = this._context;

    const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, {
      per_page: 100,
    });

    return repos
      .map((r) => {
        const owner = r.owner?.login;
        const repo = r.name;
        if (!owner || !repo) return null;
        return { owner, repo } satisfies RepoRef;
      })
      .filter((v): v is RepoRef => v !== null);
  }
}
