import { Client } from "@notionhq/client";
import { Octokit } from "@octokit/rest";
import * as cheerio from "cheerio";

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

async function run() {
  try {
    // Initialize clients
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Get PR details from GitHub context
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    const prNumber = context.payload.pull_request.number;

    // Get PR details
    const { data: pullRequest } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Get PR comments to find Linear bot comments
    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    // Filter comments to only those from Linear bot and extract ticket URLs
    const linearComments = comments.filter(
      (comment) => comment.user.login === "linear",
    );

    const linearUrls = new Set();

    // Process each Linear bot comment
    for (const comment of linearComments) {
      const urls = await extractLinearUrls(comment.body);
      urls.forEach((url) => linearUrls.add(url));
    }

    // Get release date from PR title
    const releaseDate = pullRequest.title.split(" ")[1];

    // Add tickets to Notion database
    for (const url of linearUrls) {
      // Extract ticket ID from URL (assumes URL format like https://linear.app/company/issue/TICKET-123/...)
      const ticketId = url.split("/issue/")[1].split("/")[0];

      await notion.pages.create({
        parent: {
          database_id: context.payload.notion,
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
