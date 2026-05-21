import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from "ai";
import { createGroq } from "@ai-sdk/groq";

export const maxDuration = 30;

// Create Groq provider instance
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  const {
    messages,
    systemPrompt,
    profileName,
    profileTone,
    profileExpertise,
    conversationId,
    projectTitle,
    facultySupervisor,
  }: {
    messages: UIMessage[];
    systemPrompt?: string;
    profileName?: string;
    profileTone?: string;
    profileExpertise?: string;
    conversationId?: number;
    projectTitle?: string;
    facultySupervisor?: string;
  } = await req.json();

  // Build system prompt with context from TIA profile
  const defaultSystemPrompt = `You are TIA (The Innovative Assistant), an AI research assistant for liberal arts students. 
You help students with their research projects by:
- Answering questions about research methodology
- Providing guidance on academic writing
- Helping brainstorm ideas and approaches
- Explaining complex concepts in accessible ways
- Suggesting relevant resources and approaches

Be helpful, encouraging, and educational in your responses. When you don't know something, 
be honest about it and suggest how the student might find the information they need.`;

  // Use the profile's system prompt if provided, otherwise use default
  const baseSystemPrompt = systemPrompt || defaultSystemPrompt;

  // Build contextual system prompt with profile personality and project context
  let contextualSystemPrompt = baseSystemPrompt;

  // Add profile personality traits
  if (profileName || profileTone || profileExpertise) {
    contextualSystemPrompt += `\n\n## Your Personality`;
    if (profileName) {
      contextualSystemPrompt += `\nYou are operating as the "${profileName}" assistant persona.`;
    }
    if (profileTone) {
      contextualSystemPrompt += `\nYour communication style is: ${profileTone}. Adjust your tone and responses accordingly.`;
    }
    if (profileExpertise) {
      contextualSystemPrompt += `\nYour area of expertise is: ${profileExpertise}. Prioritize insights and guidance related to this field when relevant.`;
    }
  }

  // Add project context
  if (projectTitle || facultySupervisor) {
    contextualSystemPrompt += `\n\n## Current Context`;
    if (projectTitle) {
      contextualSystemPrompt += `\nCurrent Project: ${projectTitle}`;
    }
    if (facultySupervisor) {
      contextualSystemPrompt += `\nFaculty Supervisor: ${facultySupervisor}`;
    }
  }

  // Add guidance for faculty referrals
  contextualSystemPrompt += `\n\n## Important Guidelines
If the student's question requires faculty expertise, direct input from their supervisor, 
or involves decisions that should be made with their supervisor's guidance, suggest they 
forward the question to their faculty supervisor for a more authoritative answer.

Always be supportive and encouraging. Remember that your role is to assist, not to replace 
the student's own critical thinking and their faculty supervisor's guidance.`;

  const result = streamText({
    // Using Groq directly with LLaMA 3.3 70B
    model: groq("llama-3.3-70b-versatile"),
    system: contextualSystemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ isAborted }) => {
      if (isAborted) return;
      // Messages are persisted via the existing API, not here
    },
    consumeSseStream: consumeStream,
  });
}
