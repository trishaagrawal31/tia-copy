import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    systemPrompt,
    conversationId,
    projectTitle,
    facultySupervisor,
  }: {
    messages: UIMessage[];
    systemPrompt?: string;
    conversationId?: number;
    projectTitle?: string;
    facultySupervisor?: string;
  } = await req.json();

  // Build system prompt with context
  const baseSystemPrompt =
    systemPrompt ||
    `You are TIA (The Innovative Assistant), an AI research assistant for liberal arts students. 
You help students with their research projects by:
- Answering questions about research methodology
- Providing guidance on academic writing
- Helping brainstorm ideas and approaches
- Explaining complex concepts in accessible ways
- Suggesting relevant resources and approaches

Be helpful, encouraging, and educational in your responses. When you don't know something, 
be honest about it and suggest how the student might find the information they need.`;

  const contextualSystemPrompt = `${baseSystemPrompt}

${projectTitle ? `Current Project: ${projectTitle}` : ""}
${facultySupervisor ? `Faculty Supervisor: ${facultySupervisor}` : ""}

If the student's question requires faculty expertise, direct input from their supervisor, 
or involves decisions that should be made with their supervisor's guidance, suggest they 
forward the question to their faculty supervisor for a more authoritative answer.`;

  const result = streamText({
    // Using Groq via Vercel AI Gateway
    model: "groq/llama-3.3-70b-versatile",
    system: contextualSystemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: allMessages, isAborted }) => {
      if (isAborted) return;
      // Messages are persisted via the existing API, not here
      // This callback could be used for analytics or logging
    },
    consumeSseStream: consumeStream,
  });
}
