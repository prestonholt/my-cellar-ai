'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon, WineBottleIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import { CellarTrackerForm } from './cellartracker-form';
import { WineCardsGrid } from './wine-card';
import { ToolResultSummary } from './tool-result-summary';
import { WineAnalyticsChart } from './wine-analytics-chart';
import type { UseChatHelpers } from '@ai-sdk/react';

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  requiresScrollPadding,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');
  const [connectionSuccess, setConnectionSuccess] = useState<{
    message: string;
    wineCount: number;
  } | null>(null);

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          {message.role === 'assistant' && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <WineBottleIcon size={18} />
              </div>
            </div>
          )}

          <div
            className={cn('flex flex-col gap-4 w-full', {
              'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            })}
          >
            {message.experimental_attachments &&
              message.experimental_attachments.length > 0 && (
                <div
                  data-testid={`message-attachments`}
                  className="flex flex-row justify-end gap-2"
                >
                  {message.experimental_attachments.map((attachment) => (
                    <PreviewAttachment
                      key={attachment.url}
                      attachment={attachment}
                    />
                  ))}
                </div>
              )}

            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning') {
                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.reasoning}
                  />
                );
              }

              if (type === 'text') {
                if (mode === 'view') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      {message.role === 'user' && !isReadonly && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              data-testid="message-edit-button"
                              variant="ghost"
                              className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                              onClick={() => {
                                setMode('edit');
                              }}
                            >
                              <PencilEditIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit message</TooltipContent>
                        </Tooltip>
                      )}

                      <div
                        data-testid="message-content"
                        className={cn('flex flex-col gap-4', {
                          'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                            message.role === 'user',
                        })}
                      >
                        <Markdown>{sanitizeText(part.text)}</Markdown>
                      </div>
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      <div className="size-8" />

                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        reload={reload}
                      />
                    </div>
                  );
                }
              }

              if (type === 'tool-invocation') {
                const { toolInvocation } = part;
                const { toolName, toolCallId, state } = toolInvocation;

                if (state === 'call') {
                  const { args } = toolInvocation;

                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ['getWeather'].includes(toolName),
                      })}
                    >
                      {toolName === 'getWeather' ? (
                        <Weather />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview isReadonly={isReadonly} args={args} />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolCall
                          type="update"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolCall
                          type="request-suggestions"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'connectCellarTracker' ? (
                        <div className="flex flex-col items-center gap-4 w-full">
                          {!connectionSuccess && (
                            <CellarTrackerForm
                              onSubmit={async (credentials) => {
                                setIsConnecting(true);
                                setConnectionError('');
                                try {
                                  const response = await fetch(
                                    '/api/cellartracker',
                                    {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify(credentials),
                                    },
                                  );

                                  const data = await response.json();

                                  if (!response.ok) {
                                    throw new Error(
                                      data.error ||
                                        'Failed to connect to CellarTracker',
                                    );
                                  }

                                  // Success
                                  setConnectionSuccess({
                                    message: `Successfully connected to CellarTracker!`,
                                    wineCount: data.data.length,
                                  });

                                  // Refresh the page to update the chat input availability
                                  setTimeout(() => {
                                    window.location.reload();
                                  }, 2000);
                                } catch (error) {
                                  // Show error inline
                                  setConnectionError(
                                    error instanceof Error
                                      ? error.message
                                      : 'Failed to connect',
                                  );
                                } finally {
                                  setIsConnecting(false);
                                }
                              }}
                              isLoading={isConnecting}
                              error={connectionError}
                            />
                          )}

                          {connectionSuccess && (
                            <div className="p-4 rounded-lg border max-w-md w-full text-center bg-green-50 border-green-200 text-green-800">
                              <p className="font-medium">
                                {connectionSuccess.message}
                              </p>
                              <p className="text-sm mt-1">
                                Found {connectionSuccess.wineCount} wines in
                                your cellar
                              </p>
                            </div>
                          )}
                        </div>
                      ) : toolName === 'createWineCards' ? (
                        <div className="flex justify-center w-full">
                          <div className="text-sm text-gray-600">
                            Creating wine cards...
                          </div>
                        </div>
                      ) : toolName === 'wineDataAnalytics' ? (
                        <div className="w-full max-w-6xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                          <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              Analyzing Wine Data
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                              Processing your request and generating insights...
                            </p>
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                              <span className="text-sm text-gray-500">
                                Generating SQL query and visualization
                              </span>
                            </div>
                          </div>
                          <div className="p-6">
                            <div className="animate-pulse">
                              <div className="h-64 bg-gray-200 rounded-lg mb-4" />
                              <div className="space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4" />
                                <div className="h-4 bg-gray-200 rounded w-1/2" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (state === 'result') {
                  const { result } = toolInvocation;

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        <Weather weatherAtLocation={result} />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview
                          isReadonly={isReadonly}
                          result={result}
                        />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolResult
                          type="update"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult
                          type="request-suggestions"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'connectCellarTracker' ? (
                        <div className="flex justify-center w-full">
                          <div
                            className={cn(
                              'p-4 rounded-lg border max-w-md w-full text-center',
                              result.success
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-red-50 border-red-200 text-red-800',
                            )}
                          >
                            <p className="font-medium">{result.message}</p>
                            {result.success &&
                              result.wineCount !== undefined && (
                                <p className="text-sm mt-1">
                                  Found {result.wineCount} wines in your cellar
                                </p>
                              )}
                          </div>
                        </div>
                      ) : toolName === 'createWineCards' ? (
                        <div className="w-full">
                          {result.wineCards && result.wineCards.length > 0 ? (
                            <WineCardsGrid
                              wines={result.wineCards}
                              contextMessage={result.contextMessage}
                            />
                          ) : (
                            <div className="text-center text-gray-500 py-4">
                              No wine cards to display
                            </div>
                          )}
                        </div>
                      ) : toolName === 'wineDataAnalytics' ? (
                        <div className="w-full">
                          {(result.type === 'wine-analytics' ||
                            result.type === 'dynamic-wine-analytics') &&
                          result.config ? (
                            <WineAnalyticsChart
                              title={result.config.title}
                              description={result.config.description}
                              chartData={result.chartData}
                              data={result.data}
                              summary={result.summary}
                              chartType={result.config.type}
                              xField={result.config.xField}
                              yField={result.config.yField}
                              colorField={result.config.colorField}
                              insights={result.insights}
                            />
                          ) : (
                            <div className="text-center text-gray-500 py-4">
                              Unable to display analytics
                            </div>
                          )}
                        </div>
                      ) : (
                        <ToolResultSummary
                          toolName={toolName}
                          result={result}
                        />
                      )}
                    </div>
                  );
                }
              }
            })}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message min-h-96"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <WineBottleIcon size={18} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
