import { getDb } from "@/lib/db";

let ensuringIndexesPromise: Promise<void> | null = null;

export async function ensureIndexes() {
  if (!ensuringIndexesPromise) {
    ensuringIndexesPromise = (async () => {
      const db = await getDb();

      await db.collection("users").createIndexes([
        { key: { email: 1 }, unique: true, name: "users_email_unique" },
        {
          key: { username: 1 },
          unique: true,
          sparse: true,
          name: "users_username_unique",
        },
      ]);

      await db.collection("internships").createIndexes([
        { key: { slug: 1 }, unique: true, name: "internships_slug_unique" },
        {
          key: {
            title: "text",
            skillsRequired: "text",
            description: "text",
            location: "text",
            country: "text",
          },
          name: "internships_text_search",
          weights: {
            title: 10,
            skillsRequired: 8,
            description: 4,
            location: 2,
            country: 1,
          },
        },
        { key: { skillsRequired: 1 }, name: "internships_skills_required" },
        { key: { location: 1 }, name: "internships_location" },
        { key: { country: 1 }, name: "internships_country" },
        { key: { createdAt: -1 }, name: "internships_created_at_desc" },
      ]);

      await db.collection("applications").createIndexes([
        {
          key: { internshipId: 1, studentId: 1 },
          unique: true,
          name: "applications_unique_student_internship",
        },
        {
          key: { internshipId: 1, seenByCompany: 1 },
          name: "applications_company_seen_status",
        },
        {
          key: { studentId: 1, status: 1, updatedAt: -1 },
          name: "applications_student_status_updated",
        },
      ]);

      await db.collection("chats").createIndexes([
        {
          key: { internshipId: 1, companyId: 1, studentId: 1 },
          unique: true,
          name: "chats_unique_internship_company_student",
        },
        {
          key: { companyId: 1, updatedAt: -1 },
          name: "chats_company_updated_at_desc",
        },
        {
          key: { studentId: 1, updatedAt: -1 },
          name: "chats_student_updated_at_desc",
        },
      ]);

      await db.collection("chatMessages").createIndexes([
        {
          key: { chatId: 1, createdAt: 1 },
          name: "chat_messages_chat_created_at",
        },
        {
          key: { senderId: 1, createdAt: -1 },
          name: "chat_messages_sender_created_at_desc",
        },
      ]);

      await db.collection("posts").createIndexes([
        {
          key: { authorId: 1, createdAt: -1 },
          name: "posts_author_created_at_desc",
        },
        {
          key: { createdAt: -1 },
          name: "posts_created_at_desc",
        },
      ]);

      await db.collection("postComments").createIndexes([
        {
          key: { postId: 1, createdAt: 1 },
          name: "post_comments_post_created_at",
        },
        {
          key: { parentCommentId: 1, createdAt: 1 },
          name: "post_comments_parent_created_at",
        },
        {
          key: { authorId: 1, createdAt: -1 },
          name: "post_comments_author_created_at_desc",
        },
      ]);

      await db.collection("connections").createIndexes([
        {
          key: { fromUserId: 1, toUserId: 1 },
          unique: true,
          name: "connections_unique_from_to",
        },
        {
          key: { toUserId: 1, createdAt: -1 },
          name: "connections_to_created_at_desc",
        },
      ]);

      await db.collection("notifications").createIndexes([
        {
          key: { userId: 1, isRead: 1, createdAt: -1 },
          name: "notifications_user_read_created",
        },
      ]);

      await db.collection("profileViews").createIndexes([
        {
          key: { targetUserId: 1, createdAt: -1 },
          name: "profile_views_target_created_at_desc",
        },
        {
          key: { viewerUserId: 1, createdAt: -1 },
          name: "profile_views_viewer_created_at_desc",
        },
      ]);
    })();
  }

  await ensuringIndexesPromise;
}
