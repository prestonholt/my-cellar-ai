export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'GPT-4o',
    description: 'OpenAI GPT-4o - Fast and capable model',
  },
  {
    id: 'chat-model-reasoning',
    name: 'o1',
    description: 'OpenAI o1 - Advanced reasoning model',
  },
  {
    id: 'grok-chat',
    name: 'Grok-2 Vision',
    description: 'xAI Grok-2 with vision capabilities',
  },
  {
    id: 'grok-reasoning',
    name: 'Grok-3 Mini',
    description: 'xAI Grok-3 Mini with reasoning',
  },
];
