import { getResendClient, getResendFrom } from "@/lib/resend";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { logVideoOperation } from "@/lib/video/logging";

interface VideoReadyEmailInput {
  renderId: string;
  sessionId?: string | null;
  tenantId?: string | null;
  accessToken: string;
}

export async function sendVideoReadyEmail(input: VideoReadyEmailInput): Promise<void> {
  const { renderId, sessionId, tenantId, accessToken } = input;
  const svc = createServiceSupabaseClient();

  // Load prospect via session
  let prospectEmail: string | null = null;
  let prospectName: string = "there";
  if (sessionId) {
    const { data: session } = await svc
      .from("demo_sessions")
      .select("prospect_id")
      .eq("id", sessionId)
      .single();
    if (session?.prospect_id) {
      const { data: prospect } = await svc
        .from("prospects")
        .select("email,first_name,last_name")
        .eq("id", session.prospect_id as string)
        .single();
      if (prospect) {
        prospectEmail = prospect.email as string;
        const first = prospect.first_name ?? "";
        const last = prospect.last_name ?? "";
        prospectName = `${first} ${last}`.trim() || "there";
      }
    }
  }

  if (!prospectEmail) {
    await logVideoOperation({
      operation: "video_ready_email",
      status: "error",
      message: "No prospect email — skipping notification",
      payload: { renderId, sessionId },
    });
    return;
  }

  // Load tenant branding
  let tenantName = "DemoForge";
  let tenantLogoUrl: string | null = null;
  let brandColor = "#6366f1";
  if (tenantId) {
    const { data: tenant } = await svc
      .from("tenants")
      .select("name,logo_url,brand_color")
      .eq("id", tenantId)
      .single();
    if (tenant) {
      tenantName = (tenant.name as string) || tenantName;
      tenantLogoUrl = tenant.logo_url as string | null;
      brandColor = (tenant.brand_color as string) || brandColor;
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.demoforge.io";
  const watchUrl = `${appUrl}/watch/${renderId}?token=${accessToken}`;

  const logoHtml = tenantLogoUrl
    ? `<img src="${tenantLogoUrl}" alt="${tenantName}" style="height:32px;margin-bottom:24px;" />`
    : `<p style="font-size:18px;font-weight:700;color:#111;margin-bottom:24px;">${tenantName}</p>`;

  const bodyHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111;">
      ${logoHtml}
      <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;">Hi ${prospectName} — your personalized demo is ready</h1>
      <p style="color:#444;margin:0 0 24px;line-height:1.6;">${tenantName} has prepared a personalized video demo just for you. Click below to watch it now.</p>
      <a href="${watchUrl}" style="display:inline-block;background:${brandColor};color:#fff;font-weight:600;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">Watch your demo →</a>
      <p style="margin-top:24px;font-size:12px;color:#999;">Or copy this link: <a href="${watchUrl}" style="color:${brandColor};">${watchUrl}</a></p>
    </div>
  `;

  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      to: prospectEmail,
      subject: `Your personalized demo from ${tenantName} is ready`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>${bodyHtml}</body></html>`,
    });
    if (error) throw new Error(error.message);

    await logVideoOperation({
      operation: "video_ready_email",
      status: "success",
      payload: { renderId, prospectEmail },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logVideoOperation({
      operation: "video_ready_email",
      status: "error",
      message,
      payload: { renderId, prospectEmail },
    });
    // Don't rethrow — email failure shouldn't fail the job
  }
}
