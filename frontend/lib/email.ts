// Sends the one-time trial-link email via Resend's REST API.
// Uses fetch directly so we don't add a dependency. Server-only.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL; // e.g. "Surfy <trials@yourdomain.com>"

export async function sendTrialEmail(to: string, name: string, link: string) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be set");
  }

  const firstName = name.trim().split(/\s+/)[0] || "there";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to,
      subject: "Your free Surfy trial link 🏄",
      html: trialEmailHtml(firstName, link),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend error (${res.status}): ${detail}`);
  }

  return res.json();
}

function trialEmailHtml(firstName: string, link: string) {
  return `
  <div style="margin:0;padding:0;background:#060d1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060d1a;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#0a1628;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:36px 40px 8px;">
                <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Surf<span style="color:#38bdf8;">y</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 0;">
                <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;color:#ffffff;font-weight:600;letter-spacing:-0.5px;">
                  Hey ${firstName}, your free trial is ready.
                </h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.6);">
                  Upload one surf clip and get a full AI biomechanical breakdown — stance,
                  power, and flow measured against the best in the world. No account needed.
                </p>
                <a href="${link}" style="display:inline-block;background:#38bdf8;color:#04121f;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:12px;">
                  Upload my video →
                </a>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.35);">
                  This link works for one upload and expires in 48 hours. If the button
                  doesn't work, paste this into your browser:<br>
                  <span style="color:rgba(56,189,248,0.7);word-break:break-all;">${link}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 36px;border-top:1px solid rgba(255,255,255,0.06);margin-top:24px;">
                <p style="margin:24px 0 0;font-size:12px;color:rgba(255,255,255,0.25);">© 2026 Surfy</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}
