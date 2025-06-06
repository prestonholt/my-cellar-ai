import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { retrieveNotesContext as retrieveNotesContextQuery } from './wine-cellar-tools';

interface RetrieveNotesContextProps {
  session: Session;
}

export const retrieveNotesContext = ({ session }: RetrieveNotesContextProps) =>
  tool({
  description: 'Search for relevant tasting notes in the user\'s wine collection based on a query.',
  parameters: z.object({
    query: z.string().describe('The search query for finding relevant notes'),
    limit: z.number().optional().default(5).describe('Maximum number of results'),
  }),
  execute: async (args) => {
    if (!session?.user?.id) {
      return { error: 'User not authenticated. Please connect to CellarTracker first.' };
    }

    try {
      const result = await retrieveNotesContextQuery({
        userId: session.user.id,
        ...args,
      });

      return result;
    } catch (error) {
      console.error('Error retrieving notes context:', error);
      return { error: 'Failed to retrieve notes context' };
    }
  },
  });