import type { Context } from "hono";
import * as fs from "fs";
import { REGISTRY_PATH } from "./paths";

export default async (c: Context) => {
  try {
    if (!fs.existsSync(REGISTRY_PATH)) {
      return c.json({ events: [] });
    }
    const events = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    return c.json({ events });
  } catch (err) {
    console.error("Error reading event registry:", err);
    return c.json({ error: "Failed to load events" }, 500);
  }
};
