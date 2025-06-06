import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { filterWines as filterWinesQuery } from './wine-cellar-tools';

interface FilterWinesProps {
  session: Session;
}

export const filterWines = ({ session }: FilterWinesProps) =>
  tool({
  description: 'Filter wines in the user\'s cellar by various criteria such as region, varietal, vintage, price, etc.',
  parameters: z.object({
    region: z.string().optional().describe('Filter by wine region (e.g., "Bordeaux", "Napa Valley")'),
    subRegion: z.string().optional().describe('Filter by sub-region'),
    country: z.string().optional().describe('Filter by country'),
    varietal: z.string().optional().describe('Filter by grape varietal (e.g., "Cabernet Sauvignon", "Pinot Noir")'),
    producer: z.string().optional().describe('Filter by producer/winery name'),
    vintageMin: z.string().optional().describe('Minimum vintage year (e.g., "2010")'),
    vintageMax: z.string().optional().describe('Maximum vintage year (e.g., "2020")'),
    priceMin: z.string().optional().describe('Minimum price'),
    priceMax: z.string().optional().describe('Maximum price'),
    type: z.string().optional().describe('Wine type (e.g., "Red", "White", "Sparkling")'),
    color: z.string().optional().describe('Wine color'),
    readyToDrink: z.boolean().optional().describe('Filter wines within their drinking window'),
    location: z.string().optional().describe('Storage location'),
    bin: z.string().optional().describe('Storage bin'),
    limit: z.number().optional().default(10).describe('Maximum number of results to return'),
    countOnly: z.boolean().optional().default(false).describe('Return only the count, not wine details'),
  }),
  execute: async (args) => {
    if (!session?.user?.id) {
      return { error: 'User not authenticated. Please connect to CellarTracker first.' };
    }

    try {
      const result = await filterWinesQuery({
        userId: session.user.id,
        ...args,
      });

      return result;
    } catch (error) {
      console.error('Error filtering wines:', error);
      return { error: 'Failed to filter wines' };
    }
  },
  });