import { summarizeToolResult } from '@/lib/ai/tool-result-summarizer';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { toolName, result } = await request.json();

    if (!toolName || result === undefined) {
      return NextResponse.json(
        { error: 'Missing toolName or result' },
        { status: 400 }
      );
    }

    const summary = await summarizeToolResult(toolName, result);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error in summarize-tool-result API:', error);
    return NextResponse.json(
      { error: 'Failed to summarize tool result' },
      { status: 500 }
    );
  }
}