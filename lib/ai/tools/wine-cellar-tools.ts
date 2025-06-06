import { z } from 'zod';
import { db, wine } from '../../db';
import { and, eq, gte, lte, ilike, or, isNull, count } from 'drizzle-orm';

// Schema for filterWines tool
export const filterWinesSchema = z.object({
  userId: z.string().describe('The user ID to filter wines for'),
  region: z
    .string()
    .optional()
    .describe('Filter by wine region (e.g., "Bordeaux", "Napa Valley")'),
  subRegion: z.string().optional().describe('Filter by sub-region'),
  country: z.string().optional().describe('Filter by country'),
  varietal: z
    .string()
    .optional()
    .describe(
      'Filter by grape varietal (e.g., "Cabernet Sauvignon", "Pinot Noir")',
    ),
  producer: z.string().optional().describe('Filter by producer/winery name'),
  vintageMin: z
    .string()
    .optional()
    .describe('Minimum vintage year (e.g., "2010")'),
  vintageMax: z
    .string()
    .optional()
    .describe('Maximum vintage year (e.g., "2020")'),
  priceMin: z.string().optional().describe('Minimum price'),
  priceMax: z.string().optional().describe('Maximum price'),
  type: z
    .string()
    .optional()
    .describe('Wine type (e.g., "Red", "White", "Sparkling")'),
  color: z.string().optional().describe('Wine color'),
  readyToDrink: z
    .boolean()
    .optional()
    .describe('Filter wines within their drinking window'),
  location: z.string().optional().describe('Storage location'),
  bin: z.string().optional().describe('Storage bin'),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe('Maximum number of results to return'),
  countOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe('Return only the count, not wine details'),
});

export type FilterWinesInput = z.infer<typeof filterWinesSchema>;

export async function filterWines(input: FilterWinesInput) {
  const conditions = [eq(wine.userId, input.userId)];

  if (input.region) {
    conditions.push(ilike(wine.region, `%${input.region}%`));
  }
  if (input.subRegion) {
    conditions.push(ilike(wine.subRegion, `%${input.subRegion}%`));
  }
  if (input.country) {
    conditions.push(ilike(wine.country, `%${input.country}%`));
  }
  if (input.varietal) {
    const varietalCondition = or(
      ilike(wine.varietal, `%${input.varietal}%`),
      ilike(wine.masterVarietal, `%${input.varietal}%`),
    );
    if (varietalCondition) {
      conditions.push(varietalCondition);
    }
  }
  if (input.producer) {
    conditions.push(ilike(wine.producer, `%${input.producer}%`));
  }
  if (input.vintageMin) {
    conditions.push(gte(wine.vintage, input.vintageMin));
  }
  if (input.vintageMax) {
    conditions.push(lte(wine.vintage, input.vintageMax));
  }
  if (input.priceMin) {
    conditions.push(gte(wine.price, input.priceMin));
  }
  if (input.priceMax) {
    conditions.push(lte(wine.price, input.priceMax));
  }
  if (input.type) {
    conditions.push(ilike(wine.type, `%${input.type}%`));
  }
  if (input.color) {
    conditions.push(ilike(wine.color, `%${input.color}%`));
  }
  if (input.location) {
    conditions.push(ilike(wine.location, `%${input.location}%`));
  }
  if (input.bin) {
    conditions.push(ilike(wine.bin, `%${input.bin}%`));
  }

  if (input.readyToDrink) {
    const currentYear = new Date().getFullYear().toString();
    const drinkingWindowCondition = and(
      or(lte(wine.beginConsume, currentYear), isNull(wine.beginConsume)),
      or(gte(wine.endConsume, currentYear), isNull(wine.endConsume)),
    );
    if (drinkingWindowCondition) {
      conditions.push(drinkingWindowCondition);
    }
  }

  // Get total count first
  const totalCountResult = await db
    .select({ count: count() })
    .from(wine)
    .where(and(...conditions));

  const totalCount = Number(totalCountResult[0]?.count || 0);

  if (input.countOnly) {
    return {
      count: totalCount,
      message: `Found ${totalCount} wine${totalCount !== 1 ? 's' : ''} matching your criteria.`,
    };
  }

  // Get more results than needed to allow for randomization
  const results = await db
    .select()
    .from(wine)
    .where(and(...conditions))
    .limit(Math.max(input.limit * 2, 50)); // Get at least 50 or double the limit

  // Shuffle results to avoid always getting the same wines
  const shuffledResults = results
    .map((w) => ({ ...w, randomScore: Math.random() }))
    .sort((a, b) => b.randomScore - a.randomScore)
    .slice(0, input.limit);

  // Return summarized wine info instead of full details
  const winesSummary = shuffledResults.map((w) => ({
    id: w.id,
    iWine: w.iWine,
    wine: w.wine,
    vintage: w.vintage,
    producer: w.producer,
    region: w.region,
    varietal: w.masterVarietal || w.varietal,
    location: w.location,
    bin: w.bin,
    price: w.price,
    valuation: w.valuation,
    readyToDrink: (() => {
      const currentYear = new Date().getFullYear().toString();
      const beginOk =
        !w.beginConsume ||
        Number.parseInt(w.beginConsume) <= Number.parseInt(currentYear);
      const endOk =
        !w.endConsume ||
        Number.parseInt(w.endConsume) >= Number.parseInt(currentYear);
      return beginOk && endOk;
    })(),
  }));

  return {
    wines: winesSummary,
    count: winesSummary.length,
    totalMatches: totalCount,
    message: `Showing ${winesSummary.length} of ${totalCount} wines matching your criteria.`,
    hasMore: totalCount > winesSummary.length,
  };
}

// Schema for summarizeInventory tool
export const summarizeInventorySchema = z.object({
  userId: z.string().describe('The user ID to summarize inventory for'),
});

export type SummarizeInventoryInput = z.infer<typeof summarizeInventorySchema>;

export async function summarizeInventory(input: SummarizeInventoryInput) {
  const wines = await db
    .select()
    .from(wine)
    .where(eq(wine.userId, input.userId));

  // Calculate aggregate statistics
  const totalBottles = wines.length;

  // Count by region
  const regionCounts = wines.reduce(
    (acc, w) => {
      const region = w.region || 'Unknown';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Count by varietal
  const varietalCounts = wines.reduce(
    (acc, w) => {
      const varietal = w.masterVarietal || w.varietal || 'Unknown';
      acc[varietal] = (acc[varietal] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Count by vintage decade
  const vintageCounts = wines.reduce(
    (acc, w) => {
      if (w.vintage) {
        const decade = Math.floor(Number.parseInt(w.vintage) / 10) * 10;
        const decadeLabel = `${decade}s`;
        acc[decadeLabel] = (acc[decadeLabel] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  // Count by type
  const typeCounts = wines.reduce(
    (acc, w) => {
      const type = w.type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Calculate price statistics
  const pricesWithValues = wines
    .filter((w) => w.price && Number.parseFloat(w.price) > 0)
    .map((w) => Number.parseFloat(w.price || '0'));

  const avgPrice =
    pricesWithValues.length > 0
      ? pricesWithValues.reduce((a, b) => a + b, 0) / pricesWithValues.length
      : 0;

  const totalValue = pricesWithValues.reduce((a, b) => a + b, 0);

  // Find wines ready to drink
  const currentYear = new Date().getFullYear().toString();
  const readyToDrink = wines.filter((w) => {
    const beginOk =
      !w.beginConsume ||
      Number.parseInt(w.beginConsume) <= Number.parseInt(currentYear);
    const endOk =
      !w.endConsume ||
      Number.parseInt(w.endConsume) >= Number.parseInt(currentYear);
    return beginOk && endOk;
  }).length;

  // Top producers by bottle count
  const producerCounts = wines.reduce(
    (acc, w) => {
      const producer = w.producer || 'Unknown';
      acc[producer] = (acc[producer] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const topProducers = Object.entries(producerCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([producer, count]) => ({ producer, count }));

  return {
    totalBottles,
    totalValue: totalValue.toFixed(2),
    averagePrice: avgPrice.toFixed(2),
    readyToDrink,
    regionBreakdown: regionCounts,
    varietalBreakdown: varietalCounts,
    vintageBreakdown: vintageCounts,
    typeBreakdown: typeCounts,
    topProducers,
    summary: `You have ${totalBottles} bottles in your cellar with a total value of $${totalValue.toFixed(2)}. ${readyToDrink} wines are ready to drink now.`,
  };
}

// Schema for analyzeValue tool
export const analyzeValueSchema = z.object({
  userId: z.string().describe('The user ID to analyze wine values for'),
  wineIds: z
    .array(z.string())
    .optional()
    .describe('Specific wine IDs to analyze (optional)'),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe('Number of top value wines to return'),
});

export type AnalyzeValueInput = z.infer<typeof analyzeValueSchema>;

export async function analyzeValue(input: AnalyzeValueInput) {
  const conditions = [eq(wine.userId, input.userId)];

  if (input.wineIds && input.wineIds.length > 0) {
    conditions.push(or(...input.wineIds.map((id) => eq(wine.id, id)))!);
  }

  const wines = await db
    .select()
    .from(wine)
    .where(and(...conditions));

  // Calculate ROI for each wine
  const wineAnalysis = wines
    .filter((w) => w.price && w.valuation && Number.parseFloat(w.price) > 0)
    .map((w) => {
      const pricePaid = Number.parseFloat(w.price || '0');
      const currentValue = Number.parseFloat(w.valuation || '0');
      const gain = currentValue - pricePaid;
      const roi = (gain / pricePaid) * 100;

      return {
        id: w.id,
        wine: w.wine,
        vintage: w.vintage,
        producer: w.producer,
        pricePaid,
        currentValue,
        gain,
        roi,
        roiFormatted: `${roi.toFixed(2)}%`,
      };
    })
    .sort((a, b) => b.roi - a.roi);

  const topGainers = wineAnalysis.slice(0, input.limit);
  const topLosers = wineAnalysis.slice(-input.limit).reverse();

  // Calculate overall portfolio metrics
  const totalPaid = wineAnalysis.reduce((sum, w) => sum + w.pricePaid, 0);
  const totalValue = wineAnalysis.reduce((sum, w) => sum + w.currentValue, 0);
  const totalGain = totalValue - totalPaid;
  const overallRoi = totalPaid > 0 ? (totalGain / totalPaid) * 100 : 0;

  // Simplify the return format
  const topGainersSimplified = topGainers.map((w) => ({
    wine: w.wine,
    vintage: w.vintage,
    producer: w.producer,
    roi: w.roiFormatted,
    gain: `$${w.gain.toFixed(2)}`,
  }));

  const topLosersSimplified = topLosers.map((w) => ({
    wine: w.wine,
    vintage: w.vintage,
    producer: w.producer,
    roi: w.roiFormatted,
    loss: `$${Math.abs(w.gain).toFixed(2)}`,
  }));

  return {
    message: `Your wine portfolio has ${totalGain >= 0 ? 'gained' : 'lost'} $${Math.abs(totalGain).toFixed(2)} (${overallRoi.toFixed(2)}%) in value.`,
    totalPaid: `$${totalPaid.toFixed(2)}`,
    currentValue: `$${totalValue.toFixed(2)}`,
    overallROI: `${overallRoi.toFixed(2)}%`,
    topGainers: topGainersSimplified,
    topLosers: topLosersSimplified,
  };
}

// Schema for getAvailableWineOptions tool
export const getAvailableWineOptionsSchema = z.object({
  userId: z.string().describe('The user ID to get wine options for'),
});

export type GetAvailableWineOptionsInput = z.infer<
  typeof getAvailableWineOptionsSchema
>;

export async function getAvailableWineOptions(
  input: GetAvailableWineOptionsInput,
) {
  const wines = await db
    .select()
    .from(wine)
    .where(eq(wine.userId, input.userId));

  // Get unique varieties and regions
  const varietals = [
    ...new Set(
      wines.map((w) => w.masterVarietal || w.varietal).filter(Boolean),
    ),
  ];
  const regions = [...new Set(wines.map((w) => w.region).filter(Boolean))];
  const countries = [...new Set(wines.map((w) => w.country).filter(Boolean))];
  const types = [...new Set(wines.map((w) => w.type).filter(Boolean))];

  return {
    varietals: varietals.sort(),
    regions: regions.sort(),
    countries: countries.sort(),
    types: types.sort(),
    totalWines: wines.length,
    message: `Your cellar contains ${wines.length} wines with ${varietals.length} different varietals from ${regions.length} regions.`,
  };
}

// Schema for suggestFoodPairing tool (simplified)
export const suggestFoodPairingSchema = z.object({
  userId: z.string().describe('The user ID to suggest wines for'),
  dish: z.string().describe('The dish or food to pair with wine'),
  wineType: z
    .string()
    .optional()
    .describe('Preferred wine type (Red, White, Sparkling, etc.)'),
  varietal: z.string().optional().describe('Preferred varietal'),
  region: z.string().optional().describe('Preferred region'),
  readyToDrink: z
    .boolean()
    .optional()
    .describe('Only show wines ready to drink now'),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe('Maximum number of wine suggestions'),
});

export type SuggestFoodPairingInput = z.infer<typeof suggestFoodPairingSchema>;

export async function suggestFoodPairing(input: SuggestFoodPairingInput) {
  // Build query conditions based on user preferences
  const conditions = [eq(wine.userId, input.userId)];

  if (input.wineType) {
    conditions.push(ilike(wine.type, `%${input.wineType}%`));
  }

  if (input.varietal) {
    const varietalCondition = or(
      ilike(wine.varietal, `%${input.varietal}%`),
      ilike(wine.masterVarietal, `%${input.varietal}%`),
    );
    if (varietalCondition) {
      conditions.push(varietalCondition);
    }
  }

  if (input.region) {
    conditions.push(ilike(wine.region, `%${input.region}%`));
  }

  if (input.readyToDrink) {
    const currentYear = new Date().getFullYear().toString();
    const drinkingWindowCondition = and(
      or(lte(wine.beginConsume, currentYear), isNull(wine.beginConsume)),
      or(gte(wine.endConsume, currentYear), isNull(wine.endConsume)),
    );
    if (drinkingWindowCondition) {
      conditions.push(drinkingWindowCondition);
    }
  }

  // Query for wines with larger limit to allow for better selection
  const wines = await db
    .select()
    .from(wine)
    .where(and(...conditions))
    .limit(input.limit * 3); // Get more wines to choose from

  // Return wine options for the LLM to analyze
  const wineOptionsWithRandom = wines.map((w) => ({
    id: w.id,
    iWine: w.iWine,
    wine: w.wine,
    vintage: w.vintage,
    producer: w.producer,
    varietal: w.masterVarietal || w.varietal,
    type: w.type,
    region: w.region,
    country: w.country,
    location: w.location,
    bin: w.bin,
    price: w.price,
    valuation: w.valuation,
    score: w.ct,
    readyToDrink: (() => {
      const currentYear = new Date().getFullYear().toString();
      const beginOk =
        !w.beginConsume ||
        Number.parseInt(w.beginConsume) <= Number.parseInt(currentYear);
      const endOk =
        !w.endConsume ||
        Number.parseInt(w.endConsume) >= Number.parseInt(currentYear);
      return beginOk && endOk;
    })(),
    // Add a random score for shuffling
    randomScore: Math.random(),
  }));

  // Shuffle the results to avoid always getting the same wines
  const wineOptions = wineOptionsWithRandom
    .sort((a, b) => b.randomScore - a.randomScore)
    .slice(0, input.limit)
    .map(({ randomScore, ...wine }) => wine); // Remove the random score from final result

  return {
    dish: input.dish,
    availableWines: wineOptions,
    count: wineOptions.length,
    message: `Found ${wineOptions.length} wine${wineOptions.length !== 1 ? 's' : ''} in your cellar${input.wineType ? ` of type ${input.wineType}` : ''}${input.varietal ? ` with ${input.varietal}` : ''}${input.region ? ` from ${input.region}` : ''}.`,
  };
}

// Schema for getTastingNotes tool
export const getTastingNotesSchema = z.object({
  iWine: z.string().describe('The CellarTracker wine ID'),
});

export type GetTastingNotesInput = z.infer<typeof getTastingNotesSchema>;

export async function getTastingNotes(input: GetTastingNotesInput) {
  // Get wine record from database for fallback data
  const wineRecord = await db
    .select()
    .from(wine)
    .where(eq(wine.iWine, input.iWine))
    .limit(1);

  if (wineRecord.length === 0) {
    return {
      iWine: input.iWine,
      notes: null,
      error: 'Wine not found in database',
    };
  }

  const w = wineRecord[0];

  try {
    // First, get the bottle image from the main wine page
    const wineUrl = `https://www.cellartracker.com/wine.asp?iWine=${input.iWine}`;
    const wineResponse = await fetch(wineUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    let bottleImageUrl = null;
    if (wineResponse.ok) {
      const wineHtml = await wineResponse.text();
      // Extract bottle image URL using multiple strategies
      // Strategy 1: Look for the wine_photo div specifically
      let winePhotoMatch = wineHtml.match(
        /<div[^>]*id=["']wine_photo["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/i,
      );
      if (winePhotoMatch) {
        const imgSrc = winePhotoMatch[1];
        bottleImageUrl = imgSrc.startsWith('http')
          ? imgSrc
          : `https://www.cellartracker.com${imgSrc}`;
      }

      // Strategy 2: Look for wine_images in any img src
      if (!bottleImageUrl) {
        const wineImagesMatch = wineHtml.match(
          /<img[^>]+src=["']([^"']*wine_images[^"']*)["'][^>]*>/i,
        );
        if (wineImagesMatch) {
          const imgSrc = wineImagesMatch[1];
          bottleImageUrl = imgSrc.startsWith('http')
            ? imgSrc
            : `https://www.cellartracker.com${imgSrc}`;
        }
      }

      // Strategy 3: Look for static.cellartracker.com images
      if (!bottleImageUrl) {
        const staticMatch = wineHtml.match(
          /<img[^>]+src=["']([^"']*static\.cellartracker\.com[^"']*)["'][^>]*>/i,
        );
        if (staticMatch) {
          bottleImageUrl = staticMatch[1];
        }
      }

      // Strategy 4: More general approach - look for any img in wine_photo container
      if (!bottleImageUrl) {
        // Try to find wine_photo div and extract any img src from it
        const winePhotoDiv = wineHtml.match(
          /<div[^>]*id=["']wine_photo["'][^>]*>([\s\S]*?)<\/div>/i,
        );
        if (winePhotoDiv) {
          const imgInDiv = winePhotoDiv[1].match(/src=["']([^"']+)["']/i);
          if (imgInDiv) {
            const imgSrc = imgInDiv[1];
            bottleImageUrl = imgSrc.startsWith('http')
              ? imgSrc
              : `https://www.cellartracker.com${imgSrc}`;
          }
        }
      }

      console.log(
        `Image extraction for iWine ${input.iWine}:`,
        bottleImageUrl || 'No image found',
      );
    }

    // Now get the tasting notes from the notes page
    const notesUrl = `https://www.cellartracker.com/notes.asp?iWine=${input.iWine}`;
    let notesResponse;
    try {
      notesResponse = await fetch(notesUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Referer: `https://www.cellartracker.com/wine.asp?iWine=${input.iWine}`,
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      });
    } catch (fetchError) {
      console.error(
        `Network error fetching tasting notes for iWine ${input.iWine}:`,
        fetchError,
      );
      // Return data without notes if fetch fails - use database record
      return {
        success: true,
        wineData: {
          iWine: input.iWine,
          title: w.wine || 'Wine',
          producer: w.producer || 'Unknown Producer',
          vintage: w.vintage || 'Unknown Vintage',
          region: w.region || 'Unknown Region',
          varietals: w.masterVarietal || w.varietal || 'Unknown Varietal',
          bottleImageUrl: null,
          tastingNotes: [],
        },
        message: `Found wine details for ${w.wine || 'wine'} but couldn't fetch tasting notes due to network error.`,
      };
    }

    if (!notesResponse.ok) {
      console.error(
        `HTTP ${notesResponse.status} when fetching tasting notes for iWine ${input.iWine}`,
      );
      // Return data without notes if request fails - use database record
      return {
        success: true,
        wineData: {
          iWine: input.iWine,
          title: w.wine || 'Wine',
          producer: w.producer || 'Unknown Producer',
          vintage: w.vintage || 'Unknown Vintage',
          region: w.region || 'Unknown Region',
          varietals: w.masterVarietal || w.varietal || 'Unknown Varietal',
          bottleImageUrl: null,
          tastingNotes: [],
        },
        message: `Found wine details for ${w.wine || 'wine'} but tasting notes are not available (HTTP ${notesResponse.status}).`,
      };
    }

    const notesHtml = await notesResponse.text();

    // Parse tasting notes - CellarTracker uses structured divs with itemprop
    const tastingNotes: Array<{
      date?: string;
      score?: string;
      note?: string;
      reviewer?: string;
    }> = [];

    // Method 1: Look for notes with itemprop="reviewBody"
    const reviewBodyMatches = notesHtml.match(
      /<p[^>]*itemprop=["']reviewBody["'][^>]*>(.*?)<\/p>/gis,
    );
    if (reviewBodyMatches) {
      console.log(`Found ${reviewBodyMatches.length} review body matches`);

      for (const reviewMatch of reviewBodyMatches) {
        const noteText = reviewMatch.replace(/<[^>]*>/g, '').trim();
        if (noteText.length > 2) {
          // Try to find associated reviewer and other details by looking backwards in HTML
          const reviewIndex = notesHtml.indexOf(reviewMatch);
          const contextBefore = notesHtml.substring(
            Math.max(0, reviewIndex - 2000),
            reviewIndex,
          );

          // Look for reviewer name (usually in a span with itemprop="author")
          let reviewer = '';
          const authorMatch = contextBefore.match(
            /<span[^>]*itemprop=["']author["'][^>]*>([^<]+)<\/span>/i,
          );
          if (authorMatch) {
            reviewer = authorMatch[1].trim();
          }

          // Look for score in the context
          let score = '';
          const scoreMatches = contextBefore.match(
            /(\d{1,3}(?:\.\d{1,2})?)\s*(?:pts?|points?|\/100)?/gi,
          );
          if (scoreMatches && scoreMatches.length > 0) {
            // Take the last score found (most likely to be the right one)
            score = scoreMatches[scoreMatches.length - 1];
          }

          // Look for date
          let date = '';
          const dateMatches = contextBefore.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
          if (dateMatches && dateMatches.length > 0) {
            date = dateMatches[dateMatches.length - 1];
          }

          tastingNotes.push({
            date: date || undefined,
            score: score || undefined,
            note: noteText,
            reviewer: reviewer || undefined,
          });
        }
      }
    }

    // Method 2: Fallback - look for div structures (backup method)
    if (tastingNotes.length === 0) {
      console.log('No structured notes found, trying alternative parsing...');

      // Look for any text that might be tasting notes
      const possibleNotes = notesHtml.match(
        /<p[^>]*class=["'][^"']*break_word[^"']*["'][^>]*>(.*?)<\/p>/gis,
      );
      if (possibleNotes) {
        for (const noteMatch of possibleNotes) {
          const noteText = noteMatch.replace(/<[^>]*>/g, '').trim();
          if (
            noteText.length > 10 &&
            !noteText.includes('Do you find this review helpful')
          ) {
            tastingNotes.push({
              note: noteText,
            });
          }
        }
      }
    }

    // Extract professional reviews from the notes page
    const professionalReviews: string[] = [];
    const reviewMatches = notesHtml.match(
      /(?:Wine Spectator|Robert Parker|Jancis Robinson|Wine Advocate|Decanter|James Suckling)[^<]*(?:<[^>]*>[^<]*)*?(\d{1,3}(?:\+|\-)?(?:\/100)?)/gi,
    );
    if (reviewMatches) {
      professionalReviews.push(...reviewMatches.map((review) => review.trim()));
    }

    // Extract community score from the main wine page or notes page
    let communityScore = w.ct;
    const scoreMatch =
      notesHtml.match(/Community[^<]*?(\d{1,2}\.\d{1,2})/i) ||
      notesHtml.match(/Average[^<]*?(\d{1,2}\.\d{1,2})/i);
    if (scoreMatch) {
      communityScore = scoreMatch[1];
    }

    console.log(
      `Successfully extracted ${tastingNotes.length} tasting notes for iWine ${input.iWine}`,
    );

    return {
      success: true,
      wineData: {
        iWine: input.iWine,
        title: w.wine || 'Wine',
        producer: w.producer || 'Unknown Producer',
        vintage: w.vintage || 'Unknown Vintage',
        region: w.region || 'Unknown Region',
        varietals: w.masterVarietal || w.varietal || 'Unknown Varietal',
        bottleImageUrl: bottleImageUrl || null,
        tastingNotes: tastingNotes,
        professionalReviews: professionalReviews || [],
        communityScore: communityScore || null,
        communityNotes: w.cNotes || null,
        bottleNote: w.bottleNote || null,
      },
      message: `Found ${tastingNotes.length} tasting notes for ${w.wine || 'wine'} from CellarTracker.`,
    };
  } catch (error) {
    console.error('Error scraping CellarTracker:', error);

    // Fallback to database data
    return {
      iWine: input.iWine,
      wine: w.wine,
      vintage: w.vintage,
      producer: w.producer,
      region: w.region,
      varietal: w.masterVarietal || w.varietal,
      bottleImageUrl: null,
      communityNotes: w.cNotes,
      bottleNote: w.bottleNote,
      scrapedTastingNotes: [],
      professionalReviews: [],
      communityScore: w.ct,
      cellarTrackerUrl: `https://www.cellartracker.com/wine.asp?iWine=${input.iWine}`,
      winePageUrl: `https://www.cellartracker.com/wine.asp?iWine=${input.iWine}`,
      success: false,
      error: 'Failed to scrape CellarTracker page, using cached data',
    };
  }
}

// Schema for retrieveNotesContext tool (RAG-based)
export const retrieveNotesContextSchema = z.object({
  userId: z.string().describe('The user ID to search notes for'),
  query: z.string().describe('The search query for finding relevant notes'),
  limit: z.number().optional().default(5).describe('Maximum number of results'),
});

export type RetrieveNotesContextInput = z.infer<
  typeof retrieveNotesContextSchema
>;

export async function retrieveNotesContext(input: RetrieveNotesContextInput) {
  // This is a placeholder for a future RAG implementation
  // In a real implementation, we would:
  // 1. Have wine notes embedded and stored in a vector database
  // 2. Embed the query
  // 3. Perform semantic search
  // 4. Return the most relevant note excerpts

  // For now, we'll do a simple text search
  const wines = await db
    .select()
    .from(wine)
    .where(
      and(
        eq(wine.userId, input.userId),
        or(
          ilike(wine.cNotes, `%${input.query}%`),
          ilike(wine.bottleNote, `%${input.query}%`),
        ),
      ),
    )
    .limit(input.limit);

  return {
    query: input.query,
    results: wines.map((w) => ({
      id: w.id,
      wine: w.wine,
      vintage: w.vintage,
      producer: w.producer,
      relevantNotes: w.cNotes || w.bottleNote || '',
      score: w.ct,
    })),
    message:
      'Note: This is using basic text search. A vector-based semantic search would provide better results.',
  };
}
