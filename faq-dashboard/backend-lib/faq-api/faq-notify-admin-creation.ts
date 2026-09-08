import type { Context } from "hono";

export default async (c: Context) => {
  try {
    const body = await c.req.json();
    const { question, answer, milestone, audience } = body;

    // Store the admin-created FAQ (derive origin from the request so this
    // works on any zo.space account, not just this one)
    try {
      const origin = new URL(c.req.url).origin;
      await fetch(`${origin}/api/faq/store-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "admin", question, answer, milestone, audience, timestamp: new Date().toISOString() })
      });
    } catch (e) {
      console.error("Failed to store admin FAQ:", e);
    }

    const slackWebhookUrl = process.env.SLACK_FAQ_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      console.error("SLACK_FAQ_WEBHOOK_URL not configured");
      return c.json({ error: "Slack configuration missing" }, 500);
    }

    // Format a visually distinct notification for admin-created FAQs
    const slackMessage = {
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: "📌 *NEW FAQ ADDED (Admin)*" } },
        { type: "divider" },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Milestone:*\n${milestone}` },
            { type: "mrkdwn", text: `*Audience:*\n${audience || "General"}` }
          ]
        },
        { type: "section", text: { type: "mrkdwn", text: `*Question:*\n${question}` } },
        { type: "section", text: { type: "mrkdwn", text: `*Answer:*\n${answer}` } },
        { type: "context", elements: [{ type: "mrkdwn", text: `Added: ${new Date().toLocaleString()}` }] }
      ]
    };

    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackMessage)
    });

    if (!response.ok) {
      console.error("Slack API error:", await response.text());
      return c.json({ error: "Failed to send Slack notification" }, 500);
    }

    return c.json({ success: true, message: "Admin notification sent to Slack" });
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
};
