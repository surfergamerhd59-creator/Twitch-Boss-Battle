import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { db, streamersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserInfo, validateToken } from "../lib/twitch-api.js";
import { botManager } from "../lib/twitch-bot-manager.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  TWITCH_CLIENT_ID as CLIENT_ID,
  TWITCH_CLIENT_SECRET as CLIENT_SECRET,
  TWITCH_REDIRECT_URI as REDIRECT_URI,
  SESSION_SECRET,
} from "../config.js";

const router: Router = Router();

const SCOPES = [
  "chat:read",
  "chat:edit",
  "channel:manage:broadcast",
  "moderator:manage:announcements",
  "channel:manage:predictions",
  "user:read:email",
].join(" ");

// ── Step 1: Redirect to Twitch ────────────────────────────────────────────────
router.get("/auth/twitch", (req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    force_verify: "false",
  });
  res.redirect(`https://id.twitch.tv/oauth2/authorize?${params.toString()}`);
});

// ── Step 2: Handle callback ───────────────────────────────────────────────────
router.get("/auth/callback", async (req: Request, res: Response) => {
  const code = req.query["code"] as string | undefined;
  const error = req.query["error"] as string | undefined;

  if (error || !code) {
    res.status(400).send(errorPage(error ?? "No code returned from Twitch"));
    return;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      res.status(500).send(errorPage(`Token exchange failed: ${body}`));
      return;
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      scope: string[];
    };

    // Get user info
    const userInfo = await getUserInfo(tokens.access_token);

    // Upsert streamer in DB
    const existing = await db
      .select()
      .from(streamersTable)
      .where(eq(streamersTable.twitchId, userInfo.id))
      .limit(1);

    let streamer;
    if (existing.length > 0) {
      const [updated] = await db
        .update(streamersTable)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          displayName: userInfo.displayName,
          scope: tokens.scope.join(" "),
        })
        .where(eq(streamersTable.twitchId, userInfo.id))
        .returning();
      streamer = updated;
    } else {
      const [inserted] = await db
        .insert(streamersTable)
        .values({
          twitchId: userInfo.id,
          username: userInfo.login,
          displayName: userInfo.displayName,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          botName: userInfo.login,
          scope: tokens.scope.join(" "),
        })
        .returning();
      streamer = inserted;
    }

    // Auto-connect bot
    if (streamer) {
      botManager.connect(streamer).catch(() => {
        // Non-fatal — bot can be connected manually
      });
    }

    // Issue JWT
    const jwtToken = jwt.sign(
      {
        twitchId: userInfo.id,
        username: userInfo.login,
        displayName: userInfo.displayName,
      },
      SESSION_SECRET,
      { expiresIn: "30d" }
    );

    req.log.info({ username: userInfo.login }, "Streamer authenticated");

    // Serve success page with deep link + manual token
    res.send(successPage(jwtToken, userInfo.login, userInfo.displayName, userInfo.id));
  } catch (err: unknown) {
    req.log.error({ err }, "OAuth callback error");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).send(errorPage(msg));
  }
});

// ── Get current user (validates JWT) ─────────────────────────────────────────
router.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  res.json(req.twitchUser);
});

// ── Bot status ────────────────────────────────────────────────────────────────
router.get("/auth/bot/status", requireAuth, (req: Request, res: Response) => {
  const username = req.twitchUser!.username;
  res.json({ username, status: botManager.getStatus(username) });
});

// ── Manual bot connect ────────────────────────────────────────────────────────
router.post("/auth/bot/connect", requireAuth, async (req: Request, res: Response) => {
  const username = req.twitchUser!.username;
  const [streamer] = await db
    .select()
    .from(streamersTable)
    .where(eq(streamersTable.username, username))
    .limit(1);

  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    await botManager.connect(streamer);
    res.json({ ok: true, status: "connected" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Connect failed";
    res.status(500).json({ error: msg });
  }
});

// ── HTML helpers ──────────────────────────────────────────────────────────────

function successPage(token: string, username: string, displayName: string, twitchId: string): string {
  const deepLink = `mobile://auth?token=${encodeURIComponent(token)}&username=${encodeURIComponent(username)}&displayName=${encodeURIComponent(displayName)}&twitchId=${encodeURIComponent(twitchId)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Twitch Bot — Connected!</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0e0e10;color:#efeff1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{background:#18181b;border:1px solid #2d2d30;border-radius:20px;padding:32px;max-width:400px;width:100%;text-align:center;gap:20px;display:flex;flex-direction:column}
  .icon{font-size:48px;margin-bottom:8px}
  h1{font-size:22px;font-weight:700;color:#efeff1}
  .sub{color:#adadb8;font-size:14px;line-height:1.5}
  .open-btn{display:flex;align-items:center;justify-content:center;gap:8px;background:#9146ff;color:#fff;font-weight:700;font-size:15px;padding:14px 24px;border-radius:12px;text-decoration:none;transition:opacity .15s}
  .open-btn:hover{opacity:.85}
  .divider{display:flex;align-items:center;gap:10px;color:#484850;font-size:12px}
  .divider::before,.divider::after{content:'';flex:1;height:1px;background:#2d2d30}
  .token-box{background:#0e0e10;border:1px solid #2d2d30;border-radius:10px;padding:12px;font-family:monospace;font-size:11px;word-break:break-all;color:#bf94ff;text-align:left;cursor:pointer;user-select:all}
  .hint{color:#484850;font-size:11px}
  .copy-btn{background:#2d2d30;color:#efeff1;border:none;padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600}
  .copy-btn:hover{background:#3d3d42}
</style>
</head>
<body>
<div class="card">
  <div class="icon">✅</div>
  <h1>Connected as @${displayName}!</h1>
  <p class="sub">Your Twitch account is linked. Tap the button below to open the app, or copy the token for manual entry.</p>
  <a class="open-btn" href="${deepLink}">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
    Open in App
  </a>
  <div class="divider">or copy your session token</div>
  <div class="token-box" id="tok" onclick="copyToken()">${token}</div>
  <button class="copy-btn" onclick="copyToken()" id="cpyBtn">Copy Token</button>
  <p class="hint">Paste this in the app's "Enter token manually" field if the button above didn't open the app.</p>
</div>
<script>
  function copyToken(){
    navigator.clipboard.writeText(document.getElementById('tok').textContent.trim());
    const btn=document.getElementById('cpyBtn');
    btn.textContent='Copied!';
    setTimeout(()=>btn.textContent='Copy Token',2000);
  }
  // Auto-try deep link after 1s
  setTimeout(()=>{ window.location.href='${deepLink}'; },1000);
</script>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Auth Error</title>
<style>body{background:#0e0e10;color:#efeff1;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{background:#18181b;border:1px solid #ff4040;border-radius:20px;padding:32px;max-width:400px;width:100%;text-align:center}h1{color:#ff4040;font-size:20px;margin-bottom:12px}p{color:#adadb8;font-size:14px}</style>
</head>
<body><div class="card"><h1>Authentication Error</h1><p>${message}</p></div></body>
</html>`;
}

export default router;
