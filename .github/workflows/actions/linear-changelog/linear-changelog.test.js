import { extractLinearUrls } from "./linear-changelog.js";

describe("extractLinearUrls", () => {
  test("extracts single Linear URL from simple anchor tag", async () => {
    const input =
      '<a href="https://linear.app/company/issue/ABC-123/test-ticket">ABC-123: Test ticket</a>';
    const urls = await extractLinearUrls(input);
    expect(urls).toEqual([
      "https://linear.app/company/issue/ABC-123/test-ticket",
    ]);
  });

  test("extracts multiple Linear URLs from complex HTML", async () => {
    const input = `
      <div>
        <p>Related tickets:</p>
        <a href="https://linear.app/company/issue/ABC-123/first-ticket">ABC-123</a>
        <span>and</span>
        <a href="https://linear.app/company/issue/ABC-124/second-ticket">ABC-124</a>
      </div>
    `;
    const urls = await extractLinearUrls(input);
    expect(urls).toEqual([
      "https://linear.app/company/issue/ABC-123/first-ticket",
      "https://linear.app/company/issue/ABC-124/second-ticket",
    ]);
  });

  test("ignores non-Linear URLs", async () => {
    const input = `
      <div>
        <a href="https://linear.app/company/issue/ABC-123/test-ticket">ABC-123</a>
        <a href="https://github.com/something">GitHub Link</a>
        <a href="https://other-site.com">Other Link</a>
      </div>
    `;
    const urls = await extractLinearUrls(input);
    expect(urls).toEqual([
      "https://linear.app/company/issue/ABC-123/test-ticket",
    ]);
  });

  test("handles malformed HTML gracefully", async () => {
    const input =
      '<a href="https://linear.app/company/issue/ABC-123/test-ticket">Unclosed tag';
    const urls = await extractLinearUrls(input);
    expect(urls).toEqual([
      "https://linear.app/company/issue/ABC-123/test-ticket",
    ]);
  });

  test("returns empty array for invalid input", async () => {
    const inputs = [
      "",
      null,
      undefined,
      "<not>valid</xml>>",
      "<a>No href attribute</a>",
    ];

    for (const input of inputs) {
      const urls = await extractLinearUrls(input);
      expect(urls).toEqual([]);
    }
  });

  test("handles real-world Linear bot comment format", async () => {
    const input = `<details>
<summary><a href="https://linear.app/fountain/issue/USS-650/stuart-compliance-group-not-being-unassigned-after-updating-worker">USS-650 Stuart - Compliance Group not being unassigned after updating worker profile</a></summary>
<p>

**Summary:**

Sttuart (4635c5ac-5b97-4691-906f-5484db52d9cc) [have a worker in WX](https://employer.fountain.com/workers/f37d8286-e73d-482f-9324-cc7e6ad48d3f?profileTab=compliance) who is showing as out of compliance for their Vehicle insurance which tracks with what [we see in Hire](https://app.fountain.com/stuart/applicants?applicantId=0483c8a1-1a8e-40e2-8812-4c9cabb76b78&page=1&per_page=20&query=%09amitjain14%40yahoo.com&tabIndex=0) but they raised the following:

> In this case the courier's transport type was a motorbike and he has changed it to an e-bike.
> For that reason we moved him from the "UK - Onboarding - SE - Motorbike" to the "UK - Onboarding - SE - Bike" opening in Fountain Hire. The issue here is that the courier keeps receiving messages that his Insurance has expired and he appears as out of compliance in the Fountain Compliance tool (this should not be happening because couriers need to update their Insurance only for motorbikes and cars).
>
> 
> My understanding is if a courier is within the Approved stage in Fountain Hire and if we change the opening from a motorbike or a car to a bike transport type as I added above, in theory that should update Fountain Compliance values as well and that courier should no longer be receiving messages to send us his Insurance. Otherwise, there is no point in changing and updating the transport type info in Fountain Hire if that is not reflected in the Fountain Compliance.

**Example:** 

* [Worker Profile in WX](https://employer.fountain.com/workers/f37d8286-e73d-482f-9324-cc7e6ad48d3f?profileTab=compliance)
  * [Hire Profile](https://app.fountain.com/stuart/applicants?applicantId=0483c8a1-1a8e-40e2-8812-4c9cabb76b78&page=1&per_page=20&query=%09amitjain14%40yahoo.com&tabIndex=0)

**Expected Behavior:**

When moving an applicant profile in Hire to a different opening, this should then apply the corresponding compliance group in WX

**Actual Behavior:**

When moving an applicant profile in Hire to a different opening, this does not apply the corresponding compliance group in WX

---

# Notes for testing

I believe there were some other fixes that initially led to this ticket.  however, the last bug remaining (as far as I can tell - mentioned by joe [HERE](https://linear.app/fountain/issue/USS-650/stuart-compliance-group-not-being-unassigned-after-updating-worker#comment-e3d10d28)) is that once the worker has been removed from the segment of a previously-assigned compliance document then the document/requirement is still listed on the Worker's page for the admin.  (The worker does *not* see the compliance requirement - only the admin sees it listed for the worker)

Before:

[Screenshot 2025-01-27 at 1.32.35 PM.png](https://uploads.linear.app/c24c5ecd-3c56-43fb-9511-b8f3ee427ea6/f203acec-60b0-403a-89d5-c45c43796b9b/f8a33264-bb52-4bee-be9c-35588f67c6fa)

After:

[Screenshot 2025-01-27 at 1.32.12 PM.png](https://uploads.linear.app/c24c5ecd-3c56-43fb-9511-b8f3ee427ea6/7c1e6fa1-14b7-45b2-92bd-e79f97c2df50/eb8ed7c3-ff76-4d93-afb2-440ccd951752)
</p>
</details>`;
    const urls = await extractLinearUrls(input);
    expect(urls).toEqual([
      "https://linear.app/fountain/issue/USS-650/stuart-compliance-group-not-being-unassigned-after-updating-worker",
    ]);
  });
});
