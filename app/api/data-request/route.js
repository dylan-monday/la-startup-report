// Data access request handler
// Sends submission to Tulane's Lepage Center.
//
// Email provider: Resend (https://resend.com)
// To activate:
//   1. npm install resend
//   2. Set RESEND_API_KEY in Vercel env variables
//   3. Set DATA_REQUEST_TO_EMAIL (default: lepage@tulane.edu)
//   4. Uncomment the Resend block below

const TO_EMAIL = process.env.DATA_REQUEST_TO_EMAIL || "lepage@tulane.edu";
const FROM_EMAIL = process.env.DATA_REQUEST_FROM_EMAIL || "noreply@la-startup-report.vercel.app";

export async function POST(req) {
  const body = await req.json();
  const { name, email, phone, company, use_case } = body;

  // Basic server-side validation
  if (!name || !email || !company || !use_case) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const emailContent = `
New raw data access request — Louisiana Startup Report 2026

Name:         ${name}
Organization: ${company}
Email:        ${email}
Phone:        ${phone || "Not provided"}

How they will use the data:
${use_case}

---
Submitted via la-startup-report.vercel.app
  `.trim();

  // ---- Resend email (uncomment once RESEND_API_KEY is set) ----
  // const { Resend } = await import("resend");
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: FROM_EMAIL,
  //   to: TO_EMAIL,
  //   replyTo: email,
  //   subject: `Data access request: ${name} at ${company}`,
  //   text: emailContent,
  // });
  // -------------------------------------------------------------

  // Log until email is wired up
  console.log("[data-request]", { name, email, company, use_case: use_case.substring(0, 80) });

  return Response.json({ ok: true });
}
