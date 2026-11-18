/**
 * Email sending via Resend (server-side only).
 * If RESEND_API_KEY is not configured, emails are skipped and callers
 * receive `sent: false` so the UI can surface a manual invite link instead.
 */

import { ApiError } from "@/lib/http"

const RESEND_ENDPOINT = "https://api.resend.com/emails"

function emailFrom(): string {
  return process.env.EMAIL_FROM || "YourBiz CRM <onboarding@resend.dev>"
}

export interface EmailResult {
  sent: boolean
  error?: string
}

async function send(to: string, subject: string, html: string): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false, error: "RESEND_API_KEY not configured" }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: emailFrom(), to: [to], subject, html }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[email] Resend error:", res.status, body)
      return { sent: false, error: `Resend responded ${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    console.error("[email] Send failed:", err)
    return { sent: false, error: "Network error while sending email" }
  }
}

/* ------------------------------- templates -------------------------------- */

function layout(title: string, body: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f2;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${title}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e8e2;">
        <tr>
          <td style="background:#0f766e;padding:28px 32px;">
            <span style="font-size:22px;font-weight:bold;color:#ffffff;">YourBiz<span style="background:rgba(255,255,255,0.18);border-radius:6px;padding:2px 8px;margin-left:8px;font-size:12px;letter-spacing:2px;">CRM</span></span>
            <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:6px;">Simple, powerful CRM for growing businesses</div>
          </td>
        </tr>
        <tr><td style="padding:32px;color:#2d3a36;font-size:15px;line-height:1.65;">${body}</td></tr>
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #eef2ef;color:#7a8a84;font-size:12px;line-height:1.6;">
            You received this email because of activity on YourBiz CRM.<br>
            YourBiz CRM &middot; Made for India, built for the world.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:10px;background:#0f766e;">
    <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr></table>
<div style="color:#8a9992;font-size:12px;margin:10px 0 0;">Or copy this link into your browser:<br><span style="color:#0f766e;word-break:break-all;">${href}</span></div>`
}

/* --------------------------------- emails --------------------------------- */

export async function sendWelcomeEmail(to: string, name: string, appUrl: string): Promise<EmailResult> {
  const first = name.split(" ")[0] || "there"
  return send(
    to,
    "Welcome to YourBiz CRM",
    layout(
      "Welcome to YourBiz CRM",
      `<p>Hi <strong>${escapeHtml(first)}</strong>,</p>
      <p>Your YourBiz CRM account is ready. Here is what most people do first:</p>
      <ul style="margin:14px 0;padding-left:22px;">
        <li><strong>Create your workspace</strong> &mdash; name it after your business, pick your currency and timezone.</li>
        <li><strong>Add your contacts</strong> &mdash; every person and company you sell to.</li>
        <li><strong>Move your first deal</strong> &mdash; drag it across the pipeline until it lands in Won.</li>
      </ul>
      ${button(`${appUrl}/dashboard`, "Open my dashboard")}
      <p style="margin-top:22px;">Questions? Just reply to this email &mdash; a human reads every reply.</p>`
    )
  )
}

export async function sendInvitationEmail(params: {
  to: string
  inviterName: string
  workspaceName: string
  inviteUrl: string
  role: string
  alreadyHasAccount: boolean
  appUrl: string
}): Promise<EmailResult> {
  const { to, inviterName, workspaceName, inviteUrl, role, alreadyHasAccount, appUrl } = params
  const action = alreadyHasAccount ? "Open YourBiz and accept" : "Create your account & join"
  return send(
    to,
    `${inviterName} invited you to "${workspaceName}" on YourBiz CRM`,
    layout(
      `${inviterName} invited you to a YourBiz CRM workspace`,
      `<p>Hi,</p>
      <p><strong>${escapeHtml(inviterName)}</strong> has invited you to join the workspace
      <strong>&ldquo;${escapeHtml(workspaceName)}&rdquo;</strong> on YourBiz CRM as a <strong>${role}</strong>.</p>
      <p>${
        alreadyHasAccount
          ? "Since you already have a YourBiz CRM account, accepting takes one click. You will be able to switch between this workspace and any of your own."
          : "You do not need a YourBiz CRM account yet &mdash; the link below creates it for you and drops you straight into the workspace."
      }</p>
      ${button(inviteUrl, action)}
      <p style="margin-top:22px;color:#8a9992;font-size:13px;">This invitation link expires in 7 days. After accepting, sign in any time at
      <a href="${appUrl}/login" style="color:#0f766e;">${escapeHtml(appUrl)}/login</a>.</p>`
    )
  )
}

export async function sendVerificationEmail(params: {
  to: string
  name: string
  verifyUrl: string
}): Promise<EmailResult> {
  return send(
    params.to,
    "Confirm your email for YourBiz CRM",
    layout(
      "Confirm your email",
      `<p>Hi <strong>${escapeHtml(params.name.split(" ")[0] || "there")}</strong>,</p>
      <p>One small step before your YourBiz CRM account activates &mdash; please confirm your email address.</p>
      ${button(params.verifyUrl, "Confirm my email")}
      <p style="margin-top:22px;color:#8a9992;font-size:13px;">If you did not sign up for YourBiz CRM, you can safely ignore this email.</p>`
    )
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c
  )
}

/** Thrown shape helper when caller wants to force a failure path. */
export function assertEmailConfigured(): void {
  if (!process.env.RESEND_API_KEY) {
    throw new ApiError(400, "email_not_configured", "Email sending is not configured on this server")
  }
}
