import { NextResponse } from "next/server";
import { db } from "@/db";
import { usersTable } from "@/db/schema";

export async function GET() {
  try {
    const allUsers = await db.select().from(usersTable);
    return NextResponse.json({ allUsers });
  } catch (err) {
    console.error("DB error:", err);
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    );
  }
}
