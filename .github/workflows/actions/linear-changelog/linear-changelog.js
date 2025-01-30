import { Client } from "@notionhq/client";
import { Octokit } from "@octokit/rest";
import * as cheerio from "cheerio";
import { core } from "@actions/core";

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

    console.log(urls);
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
      (comment) => comment.user.login === "linear",
    );

    return linearIssueComments.map(extractLinearUrls);
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
    const NOTION_API_KEY = core.getInput("notion-token");
    const GITHUB_TOKEN = core.getInput("github-token");
    const NOTION_DB_ID = core.getInput("notion-db");

    // Initialize clients
    const notion = new Client({ auth: NOTION_API_KEY });
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // Get PR details from GitHub context
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

    // TODO: Change to input value
    const prNumber = core.getInput("pull-request-number");

    // get the commits on the associated PR
    const { data: commits } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    const linearUrls = [];

    // loop through _those_ pull requests to get their comments
    for (const [index, commit] of commits.entries()) {
      console.log(`\n${index + 1}. Commit: ${commit.sha}`);
      console.log(
        `   Author: ${commit.commit.author.name} <${commit.commit.author.email}>`,
      );
      console.log(`   Date: ${commit.commit.author.date}`);
      console.log(`   Message: ${commit.commit.message}`);

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

          linearUrls.push(...linearTicketUrls);
        }
      }
    }

    // Get release date from PR title
    const releaseDate = pullRequest.title.split(" ")[1];

    // Add tickets to Notion database
    for (const url of linearUrls) {
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
            url: pullRequest.html_url,
          },
          Project: {
            title: [{ text: { content: repo } }],
          },
        },
      });

      console.log(`Added ticket ${ticketId} to Notion database`);
    }

    console.log("Successfully processed all tickets");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

run();
