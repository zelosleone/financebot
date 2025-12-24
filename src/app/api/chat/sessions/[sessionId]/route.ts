import * as db from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const { data: { user } } = await db.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401
    });
  }

  // Get session with messages
  const { data: session, error: sessionError } = await db.getChatSession(sessionId, user.id);

  if (sessionError || !session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404
    });
  }

  const { data: messages } = await db.getChatMessages(sessionId);

  // Normalize messages format
  const normalizedMessages = messages?.map(msg => {
    // Parse content if it's a string (SQLite stores as TEXT)
    let parsedContent: any = msg.content;
    if (typeof msg.content === 'string') {
      try {
        parsedContent = JSON.parse(msg.content);
      } catch (e) {
        parsedContent = [];
      }
    }

    return {
      id: msg.id,
      role: msg.role,
      parts: parsedContent || [],
      createdAt: (msg as any).created_at || (msg as any).createdAt,
      processing_time_ms: (msg as any).processing_time_ms || (msg as any).processingTimeMs,
    };
  }) || [];

  return new Response(JSON.stringify({
    session,
    messages: normalizedMessages
  }));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const { data: { user } } = await db.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401
    });
  }

  await db.deleteChatSession(sessionId, user.id);

  return new Response(JSON.stringify({ success: true }));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { title } = await req.json();

  const { data: { user } } = await db.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401
    });
  }

  await db.updateChatSession(sessionId, user.id, { title });

  return new Response(JSON.stringify({ success: true }));
}
