import { z } from 'zod';
import { tool, generateText, generateObject } from 'ai';
import type { Session } from 'next-auth';
import { db, wine } from '../../db';
import { myProvider } from '../providers';

interface WineDataAnalyticsProps {
  session: Session;
}

// Schema for the AI to define what data to query and how to visualize it
const analyticsConfigSchema = z.object({
  sqlQuery: z
    .string()
    .describe('Complete PostgreSQL query to execute against the wine table'),
  chartConfig: z.object({
    type: z
      .enum(['bar', 'pie', 'line', 'table'])
      .describe('Type of chart that best visualizes this data'),
    title: z.string().describe('Clear, descriptive title for the chart'),
    description: z
      .string()
      .describe('Brief explanation of what this chart shows'),
    xField: z.string().describe('Field name to use for x-axis or categories'),
    yField: z.string().describe('Field name to use for y-axis or values'),
    colorField: z
      .string()
      .optional()
      .describe('Field to use for grouping/coloring (for multi-series charts)'),
  }),
  insights: z
    .string()
    .describe('Key insights and takeaways from this analysis'),
});

export const wineDataAnalytics = ({ session }: WineDataAnalyticsProps) =>
  tool({
    description:
      'Perform completely dynamic wine collection analysis based on natural language queries. Use this for any question requiring data analysis, ranking, finding "most/least", comparisons, distributions, or SQL aggregation. The AI determines what SQL to run and how best to visualize the results.',
    parameters: z.object({
      query: z
        .string()
        .describe(
          'Natural language query for wine data analysis (e.g., "which wine do I have the most of?", "show bottles by price ranges", "top 10 producers", "compare my regions", "most expensive wines")',
        ),
    }),
    execute: async ({ query }) => {
      if (!session?.user?.id) {
        return {
          error:
            'User not authenticated. Please connect to CellarTracker first.',
        };
      }

      try {
        // Step 1: Use AI to understand the query and decide what data to fetch and how to visualize it
        const schemaDescription = `
Wine table schema (table name is "Wine" - case sensitive):
- id: string (unique identifier)
- wine: string (wine name)
- vintage: string (year)
- producer: string (winery/producer name)
- region: string (wine region)
- subRegion: string (sub-region)
- country: string (country of origin)
- varietal: string (grape variety)
- masterVarietal: string (primary grape variety)
- type: string (Red, White, Rosé, Sparkling)
- color: string (wine color)
- price: string (purchase price in dollars)
- valuation: string (current market value in dollars)
- location: string (storage location)
- bin: string (storage bin)
- beginConsume: string (start of drinking window year)
- endConsume: string (end of drinking window year)
- userId: string (user identifier - ALWAYS filter by this)

CRITICAL SQL Requirements:
- Table name is "Wine" (capital W, quoted if needed)
- Price fields are stored as strings but contain numeric values
- Use CAST(price AS NUMERIC) for calculations
- userId must ALWAYS be included in WHERE clause: "userId" = '${session.user.id}'
- For price ranges, cast to numeric: CAST("price" AS NUMERIC) BETWEEN 0 AND 100
- For vintage analysis, vintages are stored as strings: "vintage" >= '2020'
- Use double quotes around column names if they might be case-sensitive
`;

        const analysisPrompt = `You are a data analyst for wine collections. Based on the user's natural language query, you need to:

1. Generate the appropriate SQL query to get the data they want
2. Decide the best way to visualize that data (chart type)
3. Define how to map the query results to chart axes
4. Provide insights about what this analysis reveals

User Query: "${query}"

${schemaDescription}

Important guidelines:
- ALWAYS include WHERE "userId" = '${session.user.id}' in your SQL
- Use table name "Wine" (capital W)
- Quote column names with double quotes if they might be case-sensitive
- Think about what the user actually wants to see and analyze
- Choose chart types that make sense for the data:
  * Bar charts: for comparing categories (regions, varietals, producers)
  * Pie charts: for showing composition/distribution 
  * Line charts: for trends over time (vintages, purchase dates)
  * Table: for detailed listings or when data doesn't suit charts well
- Make sure your SQL returns data that can be meaningfully visualized
- Use GROUP BY and aggregation functions (COUNT, AVG, SUM) when appropriate
- Order results in a logical way (by count DESC, by vintage ASC, etc.)

Generate a complete analysis plan:`;

        const { object: config } = await generateObject({
          model: myProvider.languageModel('chat-model'),
          messages: [
            {
              role: 'user',
              content: analysisPrompt,
            },
          ],
          schema: analyticsConfigSchema,
          maxTokens: 800,
          temperature: 0.3,
        });

        // Step 2: Execute the generated SQL query with retry logic
        let data: any[] = [];
        let finalQuery = config.sqlQuery;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
          try {
            console.log(`SQL attempt ${attempts + 1}:`, finalQuery);
            const results = await db.execute(finalQuery);
            data = Array.isArray(results)
              ? results
              : (results as any).rows || [];
            break; // Success, exit the retry loop
          } catch (error: any) {
            attempts++;
            console.error(`SQL attempt ${attempts} failed:`, error.message);

            if (attempts >= maxAttempts) {
              throw error; // Give up after max attempts
            }

            // Use AI to fix the SQL based on the error
            const fixPrompt = `The SQL query failed with this error: "${error.message}"

Original query: ${finalQuery}

${schemaDescription}

Please fix the SQL query to resolve this error. Common fixes:
- Use "Wine" as the table name (capital W)
- Quote column names with double quotes if case-sensitive
- Ensure proper syntax for PostgreSQL
- Make sure all referenced columns exist in the schema

Return ONLY the corrected SQL query, no explanation:`;

            const { text: correctedQuery } = await generateText({
              model: myProvider.languageModel('chat-model'),
              messages: [
                {
                  role: 'user',
                  content: fixPrompt,
                },
              ],
              maxTokens: 200,
              temperature: 0.1,
            });

            finalQuery = correctedQuery.trim();
          }
        }

        // Step 3: Format the data for chart visualization
        const chartData = data.map((row: any) => {
          const item: any = {
            [config.chartConfig.xField]: row[config.chartConfig.xField],
            [config.chartConfig.yField]: row[config.chartConfig.yField],
          };

          if (
            config.chartConfig.colorField &&
            row[config.chartConfig.colorField]
          ) {
            item[config.chartConfig.colorField] =
              row[config.chartConfig.colorField];
          }

          return item;
        });

        // Step 4: Generate additional insights based on the actual data
        const insightPrompt = `Based on this wine collection analysis:

Query: "${query}"
Chart Type: ${config.chartConfig.type}
Data Points: ${data.length}
Sample Data: ${JSON.stringify(data.slice(0, 3), null, 2)}

Provide 2-3 sentences of actionable insights about what this data reveals about the wine collection. Focus on interesting patterns, recommendations, or notable findings.`;

        const { text: enhancedInsights } = await generateText({
          model: myProvider.languageModel('chat-model'),
          messages: [
            {
              role: 'user',
              content: insightPrompt,
            },
          ],
          maxTokens: 200,
          temperature: 0.4,
        });

        return {
          type: 'dynamic-wine-analytics',
          query: finalQuery,
          data: data,
          chartData: chartData,
          config: {
            type: config.chartConfig.type,
            title: config.chartConfig.title,
            description: config.chartConfig.description,
            xField: config.chartConfig.xField,
            yField: config.chartConfig.yField,
            colorField: config.chartConfig.colorField,
          },
          insights: enhancedInsights || config.insights,
          summary: `Analyzed ${data.length} data points for: ${config.chartConfig.title}`,
        };
      } catch (error) {
        console.error('Error in wine data analytics:', error);
        return {
          error:
            'Failed to analyze wine data. Please try rephrasing your query.',
        };
      }
    },
  });
