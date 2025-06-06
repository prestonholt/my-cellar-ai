import { z } from 'zod';
import { tool, generateText } from 'ai';
import type { Session } from 'next-auth';
import { getAvailableWineOptions, filterWines } from './wine-cellar-tools';
import { myProvider } from '../providers';

interface SuggestFoodPairingProps {
  session: Session;
}

export const suggestFoodPairing = ({ session }: SuggestFoodPairingProps) =>
  tool({
    description:
      "Suggest wines from the user's cellar that pair well with a specific dish or food using wine pairing expertise.",
    parameters: z.object({
      dish: z.string().describe('The dish or food to pair with wine'),
      wineType: z
        .string()
        .optional()
        .describe('Preferred wine type (Red, White, Sparkling, etc.)'),
      readyToDrink: z
        .boolean()
        .optional()
        .describe('Only show wines ready to drink now'),
      limit: z
        .number()
        .optional()
        .default(8)
        .describe('Maximum number of wine suggestions'),
    }),
    execute: async (args) => {
      if (!session?.user?.id) {
        return {
          error:
            'User not authenticated. Please connect to CellarTracker first.',
        };
      }

      try {
        // Step 1: Get available wine options in the user's cellar
        const availableOptions = await getAvailableWineOptions({
          userId: session.user.id,
        });

        if (availableOptions.totalWines === 0) {
          return { error: 'No wines found in your cellar.' };
        }

        // Step 2: Use LLM to determine best pairings from available options
        const pairingPrompt = `You are a wine sommelier. Based on the dish "${args.dish || ''}", analyze which wine varietals and regions would pair best from the available options below.

Available varietals: ${availableOptions.varietals.join(', ')}
Available regions: ${availableOptions.regions.join(', ')}
Available wine types: ${availableOptions.types.filter((t) => t && ['Red', 'White', 'Rosé', 'White - Sparkling'].includes(t)).join(', ')}

Please provide your recommendations in this exact JSON format:
{
  "recommendedVarietals": ["varietal1", "varietal2", "varietal3"],
  "recommendedRegions": ["region1", "region2"],
  "recommendedTypes": ["Red", "White"],
  "reasoning": "Brief explanation of why these pairings work"
}

Consider factors like:
- The preparation method and flavors of the dish
- Wine weight and intensity
- Complementary or contrasting flavor profiles
- Traditional pairing principles

Limit to 3-4 varietals and 2-3 regions maximum.`;

        const { text } = await generateText({
          model: myProvider.languageModel('chat-model'),
          messages: [
            {
              role: 'user',
              content: pairingPrompt,
            },
          ],
          maxTokens: 300,
          temperature: 0.3,
        });

        // Parse LLM response
        let pairingRecommendations;
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            pairingRecommendations = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch (parseError) {
          console.error(
            'Error parsing LLM response:',
            parseError,
            'Raw text:',
            text,
          );
          // Fallback to basic analysis
          pairingRecommendations = {
            recommendedVarietals: [
              'Pinot Noir',
              'Chardonnay',
              'Sauvignon Blanc',
            ],
            recommendedRegions: [],
            recommendedTypes: args.wineType
              ? [args.wineType]
              : ['Red', 'White'],
            reasoning:
              'Using default pairing suggestions due to analysis error.',
          };
        }

        // Step 3: Query wines based on LLM recommendations
        const wineQueries = [];

        // Query by recommended varietals
        for (const varietal of pairingRecommendations.recommendedVarietals ||
          []) {
          if (availableOptions.varietals.includes(varietal)) {
            wineQueries.push(
              filterWines({
                userId: session.user.id,
                varietal,
                readyToDrink: args.readyToDrink,
                limit: Math.ceil(args.limit / 2),
                countOnly: false,
              }),
            );
          }
        }

        // Query by recommended regions if we have them
        for (const region of pairingRecommendations.recommendedRegions || []) {
          if (availableOptions.regions.includes(region)) {
            wineQueries.push(
              filterWines({
                userId: session.user.id,
                region,
                readyToDrink: args.readyToDrink,
                limit: Math.ceil(args.limit / 2),
                countOnly: false,
              }),
            );
          }
        }

        // Query by wine type if specified or recommended
        const typesToQuery = args.wineType
          ? [args.wineType]
          : pairingRecommendations.recommendedTypes || [];
        for (const type of typesToQuery) {
          if (availableOptions.types.includes(type)) {
            wineQueries.push(
              filterWines({
                userId: session.user.id,
                type,
                readyToDrink: args.readyToDrink,
                limit: Math.ceil(args.limit / 2),
                countOnly: false,
              }),
            );
          }
        }

        // If no specific queries, get a general selection
        if (wineQueries.length === 0) {
          wineQueries.push(
            filterWines({
              userId: session.user.id,
              readyToDrink: args.readyToDrink,
              limit: args.limit * 2,
              countOnly: false,
            }),
          );
        }

        // Execute queries and combine results
        const queryResults = await Promise.all(wineQueries);
        const allWines = queryResults.flatMap((result) => result.wines || []);

        // Remove duplicates and limit results
        const seenWines = new Set();
        const uniqueWines = [];

        for (const wine of allWines) {
          const wineKey =
            `${wine.wine}-${wine.vintage}-${wine.producer}`.toLowerCase();
          if (!seenWines.has(wineKey) && uniqueWines.length < args.limit) {
            seenWines.add(wineKey);
            uniqueWines.push(wine);
          }
        }

        return {
          dish: args.dish,
          wines: uniqueWines,
          count: uniqueWines.length,
          pairingAnalysis: {
            recommendedVarietals:
              pairingRecommendations.recommendedVarietals || [],
            recommendedRegions: pairingRecommendations.recommendedRegions || [],
            recommendedTypes: pairingRecommendations.recommendedTypes || [],
            reasoning:
              pairingRecommendations.reasoning ||
              'Wine pairing analysis completed.',
          },
          message: `Found ${uniqueWines.length} wine${uniqueWines.length !== 1 ? 's' : ''} that pair well with ${args.dish}.`,
        };
      } catch (error) {
        console.error('Error suggesting food pairings:', error);
        return { error: 'Failed to suggest food pairings' };
      }
    },
  });
