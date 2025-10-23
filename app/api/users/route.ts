// import { NextResponse } from "next/server";
// import { z } from "zod";
// import { eq } from "drizzle-orm";
// import { db } from "@/db";
// import { usersTable } from "@/db/schema";

// export const dynamic = "force-dynamic";

// // Schemas
// const createSchema = z.object({
//   email: z.string().email("invalid email").max(255),
//   firstName: z.string().max(255).optional(),
//   lastName: z.string().max(255).optional(),
//   userName: z.string().max(255).optional(),
// });

// const updateSchema = z
//   .object({
//     id: z.coerce.number().int().positive(),
//     firstName: z.string().max(255).optional(),
//     lastName: z.string().max(255).optional(),
//     userName: z.string().max(255).optional(),
//     email: z.string().email().max(255).optional(),
//   })
//   .refine(
//     (d) =>
//       d.firstName !== undefined ||
//       d.lastName !== undefined ||
//       d.userName !== undefined ||
//       d.email !== undefined,
//     { message: "Nothing to update" }
//   );

// const deleteSchema = z
//   .object({
//     id: z.coerce.number().int().positive().optional(),
//     email: z.string().email().max(255).optional(),
//   })
//   .refine((d) => d.id !== undefined || d.email !== undefined, {
//     message: "Provide id or email",
//   });

// // Helpers to accept flexible payloads (plain app JSON or Clerk-like event envelopes)
// function normalizeToCreateInput(body: any) {
//   if (
//     body &&
//     typeof body === "object" &&
//     body.data &&
//     typeof body.data === "object"
//   ) {
//     const d = body.data;
//     let email: string | undefined = body.email;
//     if (!email && Array.isArray(d.email_addresses)) {
//       const primary = d.email_addresses.find(
//         (e: any) => e.id === d.primary_email_address_id
//       );
//       email = (primary ?? d.email_addresses[0])?.email_address;
//     }
//     return {
//       email,
//       firstName: body.firstName ?? d.first_name ?? undefined,
//       lastName: body.lastName ?? d.last_name ?? undefined,
//       userName: body.userName ?? d.username ?? undefined,
//     };
//   }
//   return {
//     email: body?.email,
//     firstName: body?.firstName,
//     lastName: body?.lastName,
//     userName: body?.userName,
//   };
// }

// // GET /api/users            → list all
// // GET /api/users?id=123     → get one by id
// export async function GET(req: Request) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const idParam = searchParams.get("id");

//     if (idParam) {
//       const idNum = Number(idParam);
//       if (!Number.isInteger(idNum) || idNum <= 0) {
//         return NextResponse.json({ error: "Invalid id" }, { status: 400 });
//       }
//       const rows = await db
//         .select()
//         .from(usersTable)
//         .where(eq(usersTable.id, idNum))
//         .limit(1);
//       const user = rows[0];
//       if (!user)
//         return NextResponse.json({ error: "User not found" }, { status: 404 });
//       return NextResponse.json(
//         { ...user, name: user.firstName ?? null },
//         { status: 200 }
//       );
//     }

//     const allUsers = await db.select().from(usersTable);
//     return NextResponse.json(
//       allUsers.map((u) => ({ ...u, name: u.firstName ?? null })),
//       { status: 200 }
//     );
//   } catch (err) {
//     console.error("DB error:", err);
//     return NextResponse.json(
//       { error: "Database connection failed" },
//       { status: 500 }
//     );
//   }
// }

// // create user
// export async function POST(req: Request) {
//   try {
//     const raw = await req.json();
//     const candidate = normalizeToCreateInput(raw);

//     const parsed = createSchema.safeParse(candidate);
//     if (!parsed.success) {
//       return NextResponse.json(
//         { error: "Validation failed", details: parsed.error.flatten() },
//         { status: 400 }
//       );
//     }

//     const { email, firstName, lastName, userName } = parsed.data;

//     const inserted = await db
//       .insert(usersTable)
//       .values({ email, firstName, lastName, userName })
//       .onConflictDoNothing({ target: usersTable.email })
//       .returning();

//     if (inserted.length > 0) {
//       const user = inserted[0];
//       return NextResponse.json(
//         { created: true, user: { ...user, name: user.firstName ?? null } },
//         { status: 201 }
//       );
//     }

//     // email already exists — return the existing user
//     const existing = await db
//       .select()
//       .from(usersTable)
//       .where(eq(usersTable.email, email))
//       .limit(1);
//     const user = existing[0] ?? null;
//     return NextResponse.json(
//       {
//         created: false,
//         user: user ? { ...user, name: user.firstName ?? null } : null,
//       },
//       { status: 200 }
//     );
//   } catch (err: any) {
//     console.error("DB error:", err);
//     if (err?.code === "23505") {
//       // unique_violation (Postgres)
//       return NextResponse.json(
//         { error: "Email already exists" },
//         { status: 409 }
//       );
//     }
//     return NextResponse.json(
//       { error: "Database connection failed" },
//       { status: 500 }
//     );
//   }
// }

// // update user (body: { id, name?, email? })
// export async function PATCH(req: Request) {
//   try {
//     const body = await req.json();
//     const parsed = updateSchema.safeParse(body);
//     if (!parsed.success) {
//       return NextResponse.json(
//         { error: "Validation failed", details: parsed.error.flatten() },
//         { status: 400 }
//       );
//     }

//     const { id, firstName, lastName, userName, email } = parsed.data;
//     const updates: Partial<typeof usersTable.$inferInsert> = {};
//     if (firstName !== undefined) updates.firstName = firstName;
//     if (lastName !== undefined) updates.lastName = lastName;
//     if (userName !== undefined) updates.userName = userName;
//     if (email !== undefined) updates.email = email;

//     const rows = await db
//       .update(usersTable)
//       .set(updates)
//       .where(eq(usersTable.id, id))
//       .returning();

//     if (rows.length === 0) {
//       return NextResponse.json({ error: "User not found" }, { status: 404 });
//     }

//     const user = rows[0];
//     return NextResponse.json(
//       { updated: true, user: { ...user, name: user.firstName ?? null } },
//       { status: 200 }
//     );
//   } catch (err: any) {
//     console.error("DB error:", err);
//     if (err?.code === "23505") {
//       return NextResponse.json(
//         { error: "Email already exists" },
//         { status: 409 }
//       );
//     }
//     return NextResponse.json(
//       { error: "Database connection failed" },
//       { status: 500 }
//     );
//   }
// }

// // delete user (body: { id } or { email })
// export async function DELETE(req: Request) {
//   try {
//     const body = await req.json();
//     const parsed = deleteSchema.safeParse(body);
//     if (!parsed.success) {
//       return NextResponse.json(
//         { error: "Validation failed", details: parsed.error.flatten() },
//         { status: 400 }
//       );
//     }

//     const { id, email } = parsed.data;
//     const where =
//       id !== undefined ? eq(usersTable.id, id) : eq(usersTable.email, email!);

//     const deleted = await db.delete(usersTable).where(where).returning();
//     if (deleted.length === 0) {
//       return NextResponse.json(
//         { deleted: false, error: "User not found" },
//         { status: 404 }
//       );
//     }

//     const user = deleted[0];
//     return NextResponse.json(
//       { deleted: true, user: { ...user, name: user.firstName ?? null } },
//       { status: 200 }
//     );
//   } catch (err) {
//     console.error("DB error:", err);
//     return NextResponse.json(
//       { error: "Database connection failed" },
//       { status: 500 }
//     );
//   }
// }
