import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '../(auth)/auth';
import { redirect } from 'next/navigation';
import type { UIMessage } from 'ai';
import { hasValidCellarTrackerSetup } from '@/lib/db/queries';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const id = generateUUID();

  // Check if user has valid CellarTracker setup
  const hasValidSetup = await hasValidCellarTrackerSetup(session.user.id);

  // Create initial messages based on CellarTracker setup
  const initialMessages: UIMessage[] = [];

  if (!hasValidSetup) {
    // Show CellarTracker setup message if not configured
    initialMessages.push({
      id: generateUUID(),
      role: 'assistant',
      content:
        "Welcome to My Cellar AI! I'm here to help you discover the perfect wine from your collection. To get started, please provide your CellarTracker credentials so I can access your wine inventory.",
      parts: [
        {
          type: 'text',
          text: "Welcome to My Cellar AI! I'm here to help you discover the perfect wine from your collection. To get started, please provide your CellarTracker credentials so I can access your wine inventory.",
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolName: 'connectCellarTracker',
            toolCallId: generateUUID(),
            state: 'call',
            args: {},
          },
        },
      ],
      createdAt: new Date(),
      experimental_attachments: [],
    });
  }

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');

  if (!modelIdFromCookie) {
    return (
      <>
        <Chat
          key={id}
          id={id}
          initialMessages={initialMessages}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialVisibilityType="private"
          isReadonly={false}
          session={session}
          autoResume={false}
          hasValidCellarTrackerSetup={hasValidSetup}
        />
        <DataStreamHandler id={id} />
      </>
    );
  }

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={initialMessages}
        initialChatModel={modelIdFromCookie.value}
        initialVisibilityType="private"
        isReadonly={false}
        session={session}
        autoResume={false}
        hasValidCellarTrackerSetup={hasValidSetup}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
