import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type Chat,
  message,
  vote,
  document,
  type User,
  type Document,
  type Vote,
  suggestion,
  type Suggestion,
  stream,
  cellarTrackerCredentials,
  wine,
  type Wine,
  type DBMessage,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: { id: string; differenceInHours: number }) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}

// CellarTracker related queries
export async function getCellarTrackerCredentials(userId: string) {
  try {
    const credentials = await db
      .select()
      .from(cellarTrackerCredentials)
      .where(eq(cellarTrackerCredentials.userId, userId))
      .limit(1);

    return credentials[0] || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get CellarTracker credentials',
    );
  }
}

export async function hasValidCellarTrackerSetup(userId: string) {
  try {
    // Check if user has stored credentials
    const credentials = await getCellarTrackerCredentials(userId);
    if (!credentials) {
      return false;
    }

    // Check if we have recent valid cellar data (within last 7 days for validation)
    const recentData = await getCellarData(userId, 24 * 7); // 7 days
    if (recentData?.data && recentData.data.length > 0) {
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

export async function getCellarStats(userId: string) {
  try {
    const cellarData = await getCellarData(userId, 24 * 7); // 7 days
    if (cellarData?.data) {
      return {
        wineCount: cellarData.data.length,
        lastUpdated: cellarData.fetchedAt,
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function saveCellarTrackerCredentials({
  userId,
  username,
  password,
}: {
  userId: string;
  username: string;
  password: string;
}) {
  try {
    const existing = await getCellarTrackerCredentials(userId);

    if (existing) {
      await db
        .update(cellarTrackerCredentials)
        .set({
          username,
          password,
          updatedAt: new Date(),
        })
        .where(eq(cellarTrackerCredentials.userId, userId));
    } else {
      await db.insert(cellarTrackerCredentials).values({
        userId,
        username,
        password,
      });
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save CellarTracker credentials',
    );
  }
}

export async function getCellarData(userId: string, hoursOld = 24) {
  try {
    const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

    // Get the latest fetch time for this user's wines
    const latestWines = await db
      .select()
      .from(wine)
      .where(and(eq(wine.userId, userId), gte(wine.fetchedAt, cutoffDate)))
      .orderBy(desc(wine.fetchedAt))
      .limit(1);

    if (latestWines.length === 0) {
      return null;
    }

    // Get all wines from the latest fetch
    const fetchedAt = latestWines[0].fetchedAt;
    const allWines = await db
      .select()
      .from(wine)
      .where(and(eq(wine.userId, userId), eq(wine.fetchedAt, fetchedAt)));

    return {
      data: allWines,
      fetchedAt: fetchedAt,
    };
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get cellar data');
  }
}

export async function saveCellarData({
  userId,
  data,
}: {
  userId: string;
  data: any[];
}) {
  try {
    // Delete all existing wines for this user
    await db.delete(wine).where(eq(wine.userId, userId));

    // Insert new wines with the same fetchedAt timestamp
    const fetchedAt = new Date();
    const winesToInsert = data.map((wineData) => ({
      userId,
      fetchedAt,
      iWine: wineData.iWine || null,
      barcode: wineData.Barcode || null,
      location: wineData.Location || null,
      bin: wineData.Bin || null,
      size: wineData.Size || null,
      currency: wineData.Currency || null,
      exchangeRate: wineData.ExchangeRate || null,
      valuation: wineData.Valuation || null,
      price: wineData.Price || null,
      nativePrice: wineData.NativePrice || null,
      nativePriceCurrency: wineData.NativePriceCurrency || null,
      storeName: wineData.StoreName || null,
      purchaseDate: wineData.PurchaseDate || null,
      bottleNote: wineData.BottleNote || null,
      vintage: wineData.Vintage || null,
      wine: wineData.Wine || null,
      locale: wineData.Locale || null,
      country: wineData.Country || null,
      region: wineData.Region || null,
      subRegion: wineData.SubRegion || null,
      appellation: wineData.Appellation || null,
      producer: wineData.Producer || null,
      sortProducer: wineData.SortProducer || null,
      type: wineData.Type || null,
      color: wineData.Color || null,
      category: wineData.Category || null,
      varietal: wineData.Varietal || null,
      masterVarietal: wineData.MasterVarietal || null,
      designation: wineData.Designation || null,
      vineyard: wineData.Vineyard || null,
      ct: wineData.CT || null,
      cNotes: wineData.CNotes || null,
      beginConsume: wineData.BeginConsume || null,
      endConsume: wineData.EndConsume || null,
    }));

    if (winesToInsert.length > 0) {
      // Insert wines in batches to avoid hitting database limits
      const BATCH_SIZE = 100; // Process 100 wines at a time
      const totalBatches = Math.ceil(winesToInsert.length / BATCH_SIZE);

      console.log(
        `📝 Inserting ${winesToInsert.length} wines in ${totalBatches} batches of ${BATCH_SIZE}`,
      );

      for (let i = 0; i < winesToInsert.length; i += BATCH_SIZE) {
        const batch = winesToInsert.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

        console.log(
          `📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} wines)`,
        );
        await db.insert(wine).values(batch);

        // Optional: Add a small delay between batches to reduce database load
        if (i + BATCH_SIZE < winesToInsert.length) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      console.log(`✅ Successfully inserted all ${winesToInsert.length} wines`);
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save cellar data',
    );
  }
}
