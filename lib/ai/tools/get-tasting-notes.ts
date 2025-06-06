import { z } from 'zod';
import { tool } from 'ai';
import { getTastingNotes as getTastingNotesQuery } from './wine-cellar-tools';

export const getTastingNotes = tool({
  description: 'Get tasting notes for a specific wine from CellarTracker, including community notes and bottle notes.',
  parameters: z.object({
    iWine: z.string().describe('The CellarTracker wine ID'),
  }),
  execute: async (args) => {
    try {
      const result = await getTastingNotesQuery(args);
      return result;
    } catch (error) {
      console.error('Error getting tasting notes:', error);
      return { error: 'Failed to get tasting notes' };
    }
  },
});