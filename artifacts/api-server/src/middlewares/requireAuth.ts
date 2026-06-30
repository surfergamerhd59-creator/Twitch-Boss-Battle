import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface TwitchUserPayload {
  twitchId: string;
  username: string;
  displayName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      twitchUser?: TwitchUserPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null) ??
    (req.query["token"] as string | undefined);

  if (!token) {
    res.status(401).json({ error: "Missing auth token" });
    return;
  }

  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as TwitchUserPayload;
    req.twitchUser = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
