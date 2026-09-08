import type { Context } from "hono";
import { getFPRankings, getFPADP } from "../../../backend-lib/rankings";

export async function handleGetRankings(c: Context): Promise<Response> {
  try {
    const scoring = (c.req.query("scoring") ?? "ppr") as "ppr" | "half-ppr" | "standard";
    const position = (c.req.query("position") ?? "overall") as
      | "overall" | "QB" | "RB" | "WR" | "TE" | "K" | "DST";
    const rankings = await getFPRankings(scoring, position);
    return c.json({ rankings, count: rankings.length, scoring, position });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

export async function handleGetADP(c: Context): Promise<Response> {
  try {
    const scoring = (c.req.query("scoring") ?? "ppr") as "ppr" | "half-ppr" | "standard";
    const adp = await getFPADP(scoring);
    return c.json({ adp, count: adp.length, scoring });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}
