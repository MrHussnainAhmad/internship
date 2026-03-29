import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { formatInternshipTitle } from "@/lib/format";

export async function GET(request: Request) {
  const currentUser = await getApiUser(request);
  if (!currentUser || !currentUser.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();

  const filter =
    currentUser.role === "company"
      ? { companyId: currentUser._id }
      : { studentId: currentUser._id };

  const chats = await db
    .collection("chats")
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();

  const internshipIds = chats
    .map((chat) => chat.internshipId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const partnerIds = chats
    .map((chat) =>
      currentUser.role === "company" ? chat.studentId : chat.companyId
    )
    .filter((id): id is ObjectId => id instanceof ObjectId);

  const internships = internshipIds.length
    ? await db
        .collection("internships")
        .find({ _id: { $in: internshipIds } })
        .project({ _id: 1, title: 1, slug: 1 })
        .toArray()
    : [];
  const users = partnerIds.length
    ? await db
        .collection("users")
        .find({ _id: { $in: partnerIds } })
        .project({ _id: 1, name: 1, username: 1, email: 1 })
        .toArray()
    : [];

  const internshipMap = new Map(
    internships.map((item) => [item._id.toString(), item])
  );
  const userMap = new Map(users.map((item) => [item._id.toString(), item]));

  return NextResponse.json({
    chats: chats.map((chat) => {
      const partnerId =
        currentUser.role === "company"
          ? (chat.studentId as ObjectId).toString()
          : (chat.companyId as ObjectId).toString();
      const internshipId = (chat.internshipId as ObjectId).toString();
      const internship = internshipMap.get(internshipId);
      const partner = userMap.get(partnerId);

      return {
        id: chat._id.toString(),
        internship: {
          id: internshipId,
          title: formatInternshipTitle(String(internship?.title ?? "Internship")),
          slug: String(internship?.slug ?? ""),
        },
        partner: {
          id: partnerId,
          name: String(partner?.name ?? "User"),
          username: String(partner?.username ?? ""),
          email: String(partner?.email ?? ""),
        },
        updatedAt: new Date(chat.updatedAt ?? chat.createdAt ?? Date.now()).toISOString(),
      };
    }),
  });
}
