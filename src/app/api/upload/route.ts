import { NextResponse } from "next/server";
import { extractText } from "unpdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided.", code: "bad_request" },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Accepted: PDF, TXT, MD, CSV, JSON.`,
          code: "bad_request",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB.", code: "bad_request" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const data = new Uint8Array(bytes);

    let text: string;
    let pageCount: number | undefined;

    if (file.type === "application/pdf") {
      const result = await extractText(data, { mergePages: true });
      text = result.text;
      pageCount = result.totalPages;
    } else {
      text = Buffer.from(data).toString("utf-8");
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          error: "Could not extract any text from this file.",
          code: "bad_request",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      text: text.trim(),
      fileName: file.name,
      pageCount,
    });
  } catch (error) {
    console.error("[api/upload] Error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to process the file.",
        detail,
        code: "upstream_error",
      },
      { status: 500 },
    );
  }
}
