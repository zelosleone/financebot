/**
 * Unified database interface using local SQLite only
 * All data stored locally
 */

import { getLocalDb, DEV_USER_ID } from "./local-db/client";
import { getDevUser } from "./local-db/local-auth";
import { eq, desc, and } from "drizzle-orm";
import * as schema from "./local-db/schema";

// ============================================================================
// AUTH FUNCTIONS
// ============================================================================

export async function getUser() {
  return { data: { user: getDevUser() }, error: null };
}

export async function getSession() {
  return {
    data: {
      session: {
        user: getDevUser(),
        access_token: "local-access-token",
      },
    },
    error: null,
  };
}

// ============================================================================
// USER PROFILE FUNCTIONS
// ============================================================================

export async function getUserProfile(userId: string) {
  const db = getLocalDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  return { data: user || null, error: null };
}

// ============================================================================
// CHAT SESSION FUNCTIONS
// ============================================================================

export async function getChatSessions(userId: string) {
  const db = getLocalDb();
  const sessions = await db.query.chatSessions.findMany({
    where: eq(schema.chatSessions.userId, userId),
    orderBy: [desc(schema.chatSessions.updatedAt)],
  });
  return { data: sessions, error: null };
}

export async function getChatSession(sessionId: string, userId: string) {
  const db = getLocalDb();
  const session = await db.query.chatSessions.findFirst({
    where: and(
      eq(schema.chatSessions.id, sessionId),
      eq(schema.chatSessions.userId, userId)
    ),
  });
  return { data: session || null, error: null };
}

export async function createChatSession(session: {
  id: string;
  user_id: string;
  title: string;
}) {
  const db = getLocalDb();
  await db.insert(schema.chatSessions).values({
    id: session.id,
    userId: session.user_id,
    title: session.title,
  });
  return { error: null };
}

export async function updateChatSession(
  sessionId: string,
  userId: string,
  updates: { title?: string; last_message_at?: Date }
) {
  const db = getLocalDb();
  const updateData: any = {
    updatedAt: new Date(),
  };
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.last_message_at !== undefined)
    updateData.lastMessageAt = updates.last_message_at;

  await db
    .update(schema.chatSessions)
    .set(updateData)
    .where(
      and(
        eq(schema.chatSessions.id, sessionId),
        eq(schema.chatSessions.userId, userId)
      )
    );
  return { error: null };
}

export async function deleteChatSession(sessionId: string, userId: string) {
  const db = getLocalDb();
  await db
    .delete(schema.chatSessions)
    .where(
      and(
        eq(schema.chatSessions.id, sessionId),
        eq(schema.chatSessions.userId, userId)
      )
    );
  return { error: null };
}

// ============================================================================
// CHAT MESSAGE FUNCTIONS
// ============================================================================

export async function getChatMessages(sessionId: string) {
  const db = getLocalDb();
  const messages = await db.query.chatMessages.findMany({
    where: eq(schema.chatMessages.sessionId, sessionId),
    orderBy: [schema.chatMessages.createdAt],
  });
  return { data: messages, error: null };
}

export async function saveChatMessages(
  sessionId: string,
  messages: Array<{
    id: string;
    role: string;
    content: any;
    processing_time_ms?: number;
  }>
) {
  console.log('[DB] saveChatMessages called - sessionId:', sessionId, 'messageCount:', messages.length);

  const db = getLocalDb();

  // Delete existing messages
  await db
    .delete(schema.chatMessages)
    .where(eq(schema.chatMessages.sessionId, sessionId));

  // Insert new messages
  if (messages.length > 0) {
    await db.insert(schema.chatMessages).values(
      messages.map((msg) => ({
        id: msg.id,
        sessionId: sessionId,
        role: msg.role,
        content: JSON.stringify(msg.content),
        processingTimeMs: msg.processing_time_ms,
      }))
    );
  }
  console.log('[DB] Successfully saved messages to local SQLite');
  return { error: null };
}

export async function deleteChatMessages(sessionId: string) {
  const db = getLocalDb();
  await db
    .delete(schema.chatMessages)
    .where(eq(schema.chatMessages.sessionId, sessionId));
  return { error: null };
}

// ============================================================================
// CHART FUNCTIONS
// ============================================================================

export async function getChart(chartId: string) {
  const db = getLocalDb();
  const chart = await db.query.charts.findFirst({
    where: eq(schema.charts.id, chartId),
  });
  return { data: chart || null, error: null };
}

export async function createChart(chart: {
  id: string;
  user_id: string;
  session_id: string | null;
  chart_data: any;
}) {
  const db = getLocalDb();
  await db.insert(schema.charts).values({
    id: chart.id,
    userId: chart.user_id,
    sessionId: chart.session_id || '',
    chartData: JSON.stringify(chart.chart_data),
  });
  return { error: null };
}

// ============================================================================
// CSV FUNCTIONS
// ============================================================================

export async function getCSV(csvId: string) {
  const db = getLocalDb();
  const csv = await db.query.csvs.findFirst({
    where: eq(schema.csvs.id, csvId),
  });
  return { data: csv || null, error: null };
}

export async function createCSV(csv: {
  id: string;
  user_id: string;
  session_id: string | null;
  title: string;
  description?: string;
  headers: string[];
  rows: any[][];
}) {
  const db = getLocalDb();
  await db.insert(schema.csvs).values({
    id: csv.id,
    userId: csv.user_id,
    sessionId: csv.session_id || '',
    title: csv.title,
    description: csv.description || null,
    headers: JSON.stringify(csv.headers),
    rows: JSON.stringify(csv.rows),
  });
  return { error: null };
}
