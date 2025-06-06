import { generateText } from 'ai';
import { myProvider } from './providers';

export async function summarizeToolResult(toolName: string, result: any): Promise<string> {
  try {
    // Skip summarization for some tools that have custom rendering
    const skipSummarization = ['getWeather', 'createDocument', 'updateDocument', 'requestSuggestions', 'createWineCards'];
    if (skipSummarization.includes(toolName)) {
      return JSON.stringify(result, null, 2);
    }

    // Convert result to readable text
    const resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    
    // Create a prompt for summarization
    const prompt = `You are helping to display the result of a wine-related tool call to a user. 

Tool: ${toolName}
Result: ${resultText}

Please create a brief, user-friendly summary of this result that:
1. Uses natural language instead of technical terms
2. Highlights the key information a wine enthusiast would care about
3. Is conversational and helpful
4. Avoids showing raw data or JSON
5. Is 2-3 sentences maximum

If this contains wine data, focus on the interesting insights. If it contains counts, present them naturally. If it contains errors, explain them helpfully.`;

    const { text } = await generateText({
      model: myProvider.languageModel('chat-model'),
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      maxTokens: 150,
      temperature: 0.3,
    });

    return text.trim();
  } catch (error) {
    console.error('Error summarizing tool result:', error);
    // Fallback to a simple formatted display
    if (result?.message) {
      return result.message;
    }
    if (result?.error) {
      return `Error: ${result.error}`;
    }
    return 'Tool completed successfully.';
  }
}