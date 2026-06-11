import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import { env, hasAi } from '../env';

// Structured shape we ask the model to return.
const summarySchema = z.object({
  summary: z
    .string()
    .describe('A concise 2–4 sentence summary of the call/meeting, written for a buyer’s-agent CRM.'),
  actionItems: z
    .array(
      z.object({
        description: z.string().describe('A single, clear action to take.'),
        assignedTo: z
          .string()
          .describe('Who owns it — typically "Consultant", "Client", or a named person mentioned.'),
        dueDate: z
          .string()
          .describe('Due date as YYYY-MM-DD if a timeframe is mentioned, otherwise an empty string.'),
      }),
    )
    .describe('The concrete follow-up actions arising from the conversation.'),
});

export interface GeneratedSummary {
  summary: string;
  actionItems: { description: string; assignedTo: string; dueDate: string }[];
}

export interface SummaryInput {
  type: 'call' | 'meeting';
  title: string;
  participants: string[];
  transcript: string;
}

/** Summarise a call/meeting transcript into a summary + action items using Gemini via OpenRouter. */
export async function generateMeetingSummary(input: SummaryInput): Promise<GeneratedSummary> {
  if (!hasAi) {
    throw new Error('AI is not configured (set OPENROUTER_API_KEY).');
  }

  const openrouter = createOpenRouter({ apiKey: env.AI.apiKey });

  const participants = input.participants.length ? input.participants.join(', ') : 'Not specified';

  const { object } = await generateObject({
    model: openrouter.chat(env.AI.model),
    schema: summarySchema,
    system:
      'You are an assistant for a buyer’s-agent property CRM in Auckland, New Zealand. ' +
      'You produce accurate, professional summaries of client calls and meetings and extract ' +
      'concrete action items. Only use information present in the transcript — never invent facts. ' +
      'If the transcript is empty or lacks detail, return a brief summary saying so and an empty action list.',
    prompt:
      `Summarise this ${input.type}.\n\n` +
      `Title: ${input.title}\n` +
      `Participants: ${participants}\n\n` +
      `Transcript:\n"""\n${input.transcript || '(no transcript provided)'}\n"""`,
  });

  return object;
}
