import { z } from 'zod';
import { tool, generateText } from 'ai';
import type { Session } from 'next-auth';
import { getTastingNotes as getTastingNotesQuery } from './wine-cellar-tools';
import { myProvider } from '../providers';

interface CreateWineCardsProps {
  session: Session;
}

export const createWineCards = ({ session }: CreateWineCardsProps) =>
  tool({
  description: 'Create detailed wine cards with images and tasting notes for display to the user. Use this when showing wine recommendations or search results.',
  parameters: z.object({
    wines: z.array(z.object({
      id: z.string().describe('Wine database ID'),
      iWine: z.string().optional().describe('CellarTracker wine ID for scraping'),
      wine: z.string().describe('Wine name'),
      vintage: z.string().optional().describe('Wine vintage'),
      producer: z.string().optional().describe('Producer/winery'),
      region: z.string().optional().describe('Wine region'),
      varietal: z.string().optional().describe('Grape varietal'),
      location: z.string().optional().describe('Storage location'),
      bin: z.string().optional().describe('Storage bin'),
      price: z.string().optional().describe('Purchase price'),
      valuation: z.string().optional().describe('Current valuation'),
      readyToDrink: z.boolean().optional().describe('Whether wine is ready to drink'),
    })).describe('Array of wines to create cards for'),
    contextMessage: z.string().optional().describe('Context about why these wines are being shown (e.g., "Perfect pairings for steak")'),
  }),
  execute: async ({ wines, contextMessage }) => {
    if (!session?.user?.id) {
      return { error: 'User not authenticated. Please connect to CellarTracker first.' };
    }

    try {
      const wineCards = [];
      const seenWines = new Set(); // Track wines to avoid duplicates
      
      for (const wine of wines) {
        // Create a unique key for this wine to avoid duplicates
        const wineKey = `${wine.wine}-${wine.vintage}-${wine.producer}`.toLowerCase();
        if (seenWines.has(wineKey)) {
          continue; // Skip duplicate wines
        }
        seenWines.add(wineKey);
        let wineCardData = {
          id: wine.id,
          wine: wine.wine,
          vintage: wine.vintage,
          producer: wine.producer,
          region: wine.region,
          varietal: wine.varietal,
          location: wine.location,
          bin: wine.bin,
          price: wine.price,
          valuation: wine.valuation,
          readyToDrink: wine.readyToDrink,
          bottleImageUrl: null as string | null,
          tastingNotesSummary: null as string | null,
          professionalReviews: [] as string[],
          communityScore: null as string | null,
          cellarTrackerUrl: null as string | null,
        };

        // If we have an iWine ID, fetch detailed data from CellarTracker
        if (wine.iWine) {
          try {
            const detailedData = await getTastingNotesQuery({ iWine: wine.iWine });
            
            wineCardData = {
              ...wineCardData,
              bottleImageUrl: detailedData.bottleImageUrl || null,
              professionalReviews: detailedData.professionalReviews || [],
              communityScore: detailedData.communityScore || null,
              cellarTrackerUrl: detailedData.cellarTrackerUrl || null,
            };

            // Use LLM to summarize the tasting notes
            if (detailedData.scrapedTastingNotes && detailedData.scrapedTastingNotes.length > 0) {
              try {
                // Prepare the prompt for LLM summarization
                const wineName = `${wine.wine} ${wine.vintage || ''}`.trim();
                let notesText = `Wine: ${wineName}\n\n`;
                
                if (detailedData.communityScore) {
                  notesText += `Community Score: ${detailedData.communityScore}\n\n`;
                }
                
                if (detailedData.professionalReviews && detailedData.professionalReviews.length > 0) {
                  notesText += `Professional Reviews:\n${detailedData.professionalReviews.join('\n')}\n\n`;
                }
                
                notesText += `Community Tasting Notes:\n`;
                detailedData.scrapedTastingNotes.forEach((note, index) => {
                  notesText += `${index + 1}. `;
                  if (note.date) notesText += `[${note.date}] `;
                  if (note.reviewer) notesText += `${note.reviewer}: `;
                  if (note.score) notesText += `Score: ${note.score} - `;
                  if (note.note) notesText += note.note;
                  notesText += '\n';
                });

                const summaryPrompt = `Please create a concise, informative summary of these wine tasting notes. Focus on:
1. Overall consensus on flavor profile and characteristics
2. Key descriptors that appear consistently
3. Drinking readiness and potential
4. Any notable professional scores or reviews
5. Overall quality assessment

Keep the summary to 2-3 sentences that would help someone decide if they want to drink this wine.

Tasting Notes:
${notesText}`;

                // Use the LLM to generate a summary
                const { text } = await generateText({
                  model: myProvider.languageModel('chat-model'),
                  messages: [
                    {
                      role: 'user',
                      content: summaryPrompt,
                    },
                  ],
                  maxTokens: 200,
                  temperature: 0.3,
                });

                wineCardData.tastingNotesSummary = text.trim();
              } catch (error) {
                console.error('Error summarizing tasting notes:', error);
                // Fallback to simple concatenation
                const simpleNotes = detailedData.scrapedTastingNotes
                  .filter(note => note.note && note.note.length > 10)
                  .slice(0, 2)
                  .map(note => note.note)
                  .join(' ');
                wineCardData.tastingNotesSummary = simpleNotes || null;
              }
            } else {
              // Fallback to database notes if no scraped notes
              const fallbackNotes = [detailedData.communityNotes, detailedData.bottleNote]
                .filter(Boolean)
                .join('. ');
              if (fallbackNotes.length > 10) {
                wineCardData.tastingNotesSummary = fallbackNotes.length > 200 
                  ? fallbackNotes.substring(0, 200) + '...' 
                  : fallbackNotes;
              }
            }
          } catch (error) {
            console.error(`Error fetching details for wine ${wine.iWine}:`, error);
            // Continue with basic data but still set CellarTracker URL
            wineCardData.cellarTrackerUrl = `https://www.cellartracker.com/wine.asp?iWine=${wine.iWine}`;
          }
        } else if (wine.iWine) {
          // Even if we don't fetch detailed data, provide CellarTracker link if we have iWine
          wineCardData.cellarTrackerUrl = `https://www.cellartracker.com/wine.asp?iWine=${wine.iWine}`;
        }

        wineCards.push(wineCardData);
      }

      return {
        wineCards,
        contextMessage,
        totalCards: wineCards.length,
        message: `Created ${wineCards.length} wine card${wineCards.length !== 1 ? 's' : ''} for display.`,
      };

    } catch (error) {
      console.error('Error creating wine cards:', error);
      return { error: 'Failed to create wine cards' };
    }
  },
  });