import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { summarizeInventory as summarizeInventoryQuery } from './wine-cellar-tools';

interface SummarizeInventoryProps {
  session: Session;
}

export const summarizeInventory = ({ session }: SummarizeInventoryProps) =>
  tool({
  description: 'Get a comprehensive summary of the user\'s wine cellar including total bottles, value, regional breakdown, and other aggregate statistics.',
  parameters: z.object({}),
  execute: async () => {
    if (!session?.user?.id) {
      return { error: 'User not authenticated. Please connect to CellarTracker first.' };
    }

    try {
      const result = await summarizeInventoryQuery({
        userId: session.user.id,
      });

      return result;
    } catch (error) {
      console.error('Error summarizing inventory:', error);
      return { error: 'Failed to summarize inventory' };
    }
  },
  });