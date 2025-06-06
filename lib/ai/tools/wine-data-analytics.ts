import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { dynamicWineAnalytics as dynamicWineAnalyticsQuery } from './dynamic-wine-analytics';

interface WineDataAnalyticsProps {
  session: Session;
}

export const wineDataAnalytics = ({ session }: WineDataAnalyticsProps) =>
  tool({
    description: 'Perform completely dynamic wine collection analysis based on natural language queries. Use this for any question requiring data analysis, ranking, finding "most/least", comparisons, distributions, or SQL aggregation. The AI determines what SQL to run and how best to visualize the results.',
    parameters: z.object({
      query: z.string().describe('Natural language query for wine data analysis (e.g., "which wine do I have the most of?", "show bottles by price ranges", "top 10 producers", "compare my regions", "most expensive wines")'),
    }),
    execute: async (args) => {
      if (!session?.user?.id) {
        return { error: 'User not authenticated. Please connect to CellarTracker first.' };
      }

      try {
        // Use the dynamic wine analytics function
        const analysisResult = await dynamicWineAnalyticsQuery({ session }).execute({
          query: args.query,
        });

        if (analysisResult.error) {
          return { error: analysisResult.error };
        }

        return {
          type: 'dynamic-wine-analytics',
          data: analysisResult.data,
          chartData: analysisResult.chartData,
          config: analysisResult.config,
          insights: analysisResult.insights,
          summary: analysisResult.summary,
          query: analysisResult.query,
        };
      } catch (error) {
        console.error('Error in wine data analytics:', error);
        return { error: 'Failed to analyze wine data. Please try rephrasing your query.' };
      }
    },
  });