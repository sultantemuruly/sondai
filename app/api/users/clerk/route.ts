import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const config = {
  runtime: "edge",
  matcher: ["/api/webhooks/clerk"],
};

export async function GET() {
  return new NextResponse("Health Check", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const event = (await verifyWebhook(req, {
      signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET!,
    })) as WebhookEvent;

    if (event.type === "user.created" || event.type === "user.updated") {
      const {
        id,
        email_addresses,
        first_name,
        last_name,
        created_at, // ISO timestamp string
      } = event.data;

      const email = email_addresses?.[0]?.email_address ?? "";
      const when = new Date(created_at);

      await db
        .insert(users)
        .values({
          clerk_id: id,
          email,
          first_name: first_name ?? "",
          last_name: last_name ?? "",
          created_at: when,
        })
        .onConflictDoUpdate({
          target: users.clerk_id,
          set: {
            email: sql`EXCLUDED.email`,
            first_name: sql`EXCLUDED.first_name`,
            last_name: sql`EXCLUDED.last_name`,
          },
        });
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new NextResponse("Bad Request", { status: 400 });
  }
}
