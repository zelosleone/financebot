import * as db from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET(req: Request) {
  const { data: { user } } = await db.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { data: sessions } = await db.getChatSessions(user.id);

  // Normalize field names for client consistency
  const normalizedSessions = sessions?.map((s: any) => ({
    id: s.id,
    title: s.title,
    created_at: s.created_at || s.createdAt,
    updated_at: s.updated_at || s.updatedAt,
    last_message_at: s.last_message_at || s.lastMessageAt,
  })) || [];

  return new Response(JSON.stringify({ sessions: normalizedSessions }), {
    headers: { "Content-Type": "application/json" }
  });
}

export async function POST(req: Request) {
  const { title = "New Chat" } = await req.json();

  const { data: { user } } = await db.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const sessionId = randomUUID();
  await db.createChatSession({
    id: sessionId,
    user_id: user.id,
    title
  });

  // Fetch the newly created session
  const { data: session } = await db.getChatSession(sessionId, user.id);

  return new Response(JSON.stringify({ session }), {
    headers: { "Content-Type": "application/json" }
  });
}
