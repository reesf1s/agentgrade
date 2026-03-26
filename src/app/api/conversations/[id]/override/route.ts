import { NextRequest, NextResponse } from "next/server";

/**
 * Submit a human quality override for a conversation score.
 * POST /api/conversations/:id/override
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (!body.dimension || body.override_score === undefined) {
      return NextResponse.json(
        { error: "dimension and override_score are required" },
        { status: 400 }
      );
    }

    // In production: store override in quality_overrides table
    // and use it to calibrate future scoring
    return NextResponse.json({
      conversation_id: params.id,
      dimension: body.dimension,
      original_score: body.original_score,
      override_score: body.override_score,
      reason: body.reason,
      message: "Override recorded. This will calibrate future scoring.",
    });
  } catch (error) {
    console.error("Override error:", error);
    return NextResponse.json({ error: "Failed to record override" }, { status: 500 });
  }
}
