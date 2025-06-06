import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { analyzeValue as analyzeValueQuery } from './wine-cellar-tools';

interface AnalyzeValueProps {
  session: Session;
}

export const analyzeValue = ({ session }: AnalyzeValueProps) =>
  tool({
  description: 'Analyze wine values in the user\'s cellar, comparing current valuation to purchase price, calculating ROI, and identifying best value wines.',
  parameters: z.object({
    wineIds: z.array(z.string()).optional().describe('Specific wine IDs to analyze (optional)'),
    limit: z.number().optional().default(10).describe('Number of top value wines to return'),
  }),
  execute: async (args) => {
    if (!session?.user?.id) {
      return { error: 'User not authenticated. Please connect to CellarTracker first.' };
    }

    try {
      const result = await analyzeValueQuery({
        userId: session.user.id,
        ...args,
      });

      return result;
    } catch (error) {
      console.error('Error analyzing wine values:', error);
      return { error: 'Failed to analyze wine values' };
    }
  },
  });