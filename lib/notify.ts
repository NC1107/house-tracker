/**
 * Email delivery via Resend (single-user). Sends to ALERT_EMAIL. No SDK — just the REST API.
 * When RESEND_API_KEY / ALERT_EMAIL aren't set, it logs and no-ops so the rest works.
 */
export interface SendResult {
  sent: boolean;
  reason?: string;
}

export async function sendEmail(subject: string, html: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  const from = process.env.ALERT_FROM || "House Tracker <onboarding@resend.dev>";

  if (!key || !to) {
    console.warn(`[notify] RESEND_API_KEY/ALERT_EMAIL not set — skipping email: ${subject}`);
    return { sent: false, reason: "unconfigured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[notify] Resend failed ${res.status}: ${body}`);
      return { sent: false, reason: `resend ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[notify] send error:", (e as Error).message);
    return { sent: false, reason: (e as Error).message };
  }
}
