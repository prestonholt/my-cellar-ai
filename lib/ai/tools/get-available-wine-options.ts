import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { getAvailableWineOptions as getAvailableWineOptionsQuery } from './wine-cellar-tools';

interface GetAvailableWineOptionsProps {
  session: Session;
}

export const getAvailableWineOptions = ({ session }: GetAvailableWineOptionsProps) =>
  tool({
  description: 'Get all available wine varietals, regions, countries, and types in the user\'s cellar for analysis and pairing suggestions.',
  parameters: z.object({}),
  execute: async () => {
    if (!session?.user?.id) {
      return { error: 'User not authenticated. Please connect to CellarTracker first.' };
    }

    try {
      const result = await getAvailableWineOptionsQuery({
        userId: session.user.id,
      });

      return result;
    } catch (error) {
      console.error('Error getting available wine options:', error);
      return { error: 'Failed to get available wine options' };
    }
  },
  });