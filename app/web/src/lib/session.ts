import { createHmac } from "crypto";

export function sessionToken(): string {
  return createHmac("sha256", process.env.APP_SECRET!).update("session").digest("hex");
}
