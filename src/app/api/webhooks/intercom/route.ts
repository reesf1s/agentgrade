import { NextRequest, NextResponse } from "next/server";

/**
 * Intercom webhook receiver.
 * Receives conversation events and triggers scoring.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Intercom sends different topic types
    const topic = body.topic;

    if (topic === "conversation.admin.closed" || topic === "conversation.user.created") {
      // Extract conversation data from Intercom's format
      const intercomConversation = body.data?.item;
      if (!intercomConversation) {
        return NextResponse.json({ error: "No conversation data" }, { status: 400 });
      }

      // In production: transform Intercom format to our schema, store, and score
      return NextResponse.json({ received: true, topic });
    }

    // Ping/test webhook
    if (topic === "ping") {
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true, topic, note: "Event type not processed" });
  } catch (error) {
    console.error("Intercom webhook error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
