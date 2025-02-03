import { Client } from "@notionhq/client";
import { Octokit } from "@octokit/rest";
import * as cheerio from "cheerio";
import * as core from "@actions/core";

export async function extractLinearUrls(htmlContent) {
  try {
    const urls = [];

    const $ = cheerio.load(htmlContent);

    $("a").each((_, element) => {
      const href = $(element).attr("href");
      if (href.startsWith("https://linear.app")) {
        urls.push(href);
      }
    });

    return urls;
  } catch (error) {
    console.error("Error parsing html:", error);
    return [];
  }
}

async function getLinearUrlsFromComments(octokit, owner, repo, pullNumber) {
  try {
    // Get only issue comments on the PR
    const { data: issueComments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber,
    });

    // Filter comments to only those from 'linear' user
    const linearIssueComments = issueComments.filter(
      (comment) => comment.user.login === "linear[bot]",
    );

    const urlArray = await Promise.all(
      linearIssueComments.map(async (comment) =>
        extractLinearUrls(comment.body),
      ),
    );

    return urlArray;
  } catch (error) {
    console.error(
      `Error fetching comments for PR #${pullNumber}:`,
      error.message,
    );
    return [];
  }
}

async function findPullRequestsForCommit(octokit, owner, repo, commitSha) {
  try {
    const { data: associatedPRs } =
      await octokit.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: commitSha,
      });
    return associatedPRs;
  } catch (error) {
    console.error(`Error finding PRs for commit ${commitSha}:`, error.message);
    return [];
  }
}

async function run() {
  try {
    const GITHUB_TOKEN =
      core.getInput("github-token") || process.env.GITHUB_TOKEN;
    const NOTION_DB_ID =
      core.getInput("notion-db", {}) || process.env.NOTION_DB;
    const NOTION_API_KEY =
      core.getInput("notion-token", {}) || process.env.NOTION_TOKEN;

    if (GITHUB_TOKEN.length < 3) {
      console.error("github token is doinked my dude");
    }
    // Initialize clients
    const notion = new Client({ auth: NOTION_API_KEY });
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // Get PR details from GitHub context
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

    // TODO: PR Number Input
    const prNumber = 31286; //core.getInput("pull-request-number");

    // get the commits on the associated PR
    const { data: commits } = await octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber,
    });

    const linearUrls = await Promise.all(
      commits.map(async (commit) => {
        const intermediate = [];
        // Find associated PRs for this commit
        const associatedPRs = await findPullRequestsForCommit(
          octokit,
          owner,
          repo,
          commit.sha,
        );

        if (associatedPRs.length > 0) {
          console.log("   Associated Pull Requests:");
          for (const pr of associatedPRs) {
            console.log(`     - #${pr.number}: ${pr.title} (${pr.state})`);

            // Get Linear's comments for this PR
            const linearTicketUrls = await getLinearUrlsFromComments(
              octokit,
              owner,
              repo,
              pr.number,
            );
            if (linearTicketUrls) {
              intermediate.push(linearTicketUrls);
            }
          }
        }

        return intermediate;
      }),
    );

    // TODO: Get release date from PR title or new Date()
    const releaseDate = "2022-02-02"; //pullRequest.title.split(" ")[1];

    // Add tickets to Notion database
    for (const url of linearUrls.flat(Infinity)) {
      // Extract ticket ID from URL (assumes URL format like https://linear.app/company/issue/TICKET-123/...)
      const ticketId = url.split("/issue/")[1].split("/")[0];

      await notion.pages.create({
        parent: {
          database_id: NOTION_DB_ID,
        },
        properties: {
          "Linear Ticket": {
            title: [
              {
                text: {
                  content: ticketId,
                },
              },
            ],
          },
          "Ticket URL": {
            url: url,
          },
          "Release Date": {
            date: {
              start: releaseDate,
            },
          },
          "Pull Request": {
            url: "https://github.com/pullRequest.html_url",
          },
          Project: {
            rich_text: [{ text: { content: repo } }],
            type: "rich_text",
          },
        },
      });

      console.log(`Added ticket ${ticketId} to Notion database`);
    }

    console.log(
      `Successfully processed ${linearUrls.length} commits from the release PR`,
    );
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

run();
