"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import {
  getConversation,
  getMessages,
  sendMessage as sendMessageToApi,
  getTiaProfiles,
} from "@/lib/api";
import {
  Alert,
  Button,
  LoadingSpinner,
  useToast,
  EmptyState,
} from "@/components";
import {
  Send,
  MessageSquare,
  ChevronLeft,
  User,
  Zap,
  Forward,
  Check,
  X,
  Settings,
} from "lucide-react";

interface Message {
  message_id: number;
  sender_type: string;
  content: string;
  message_role: string;
  created_at: string;
  sender_user_id: number | null;
}

interface FacultySummary {
  user_id: number;
  full_name: string;
  email: string;
}

interface ProjectSummary {
  project_id: number;
  title: string;
  faculty_supervisor_id: number | null;
  faculty_supervisor: FacultySummary | null;
}

interface Conversation {
  conversation_id: number;
  title: string;
  project_id: number;
  tia_profile_id: number;
  project?: ProjectSummary | null;
}

interface TiaProfile {
  tia_profile_id: number;
  name: string;
  system_prompt: string;
  tone: string;
  expertise_area: string | null;
  description?: string;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = Number(params.id);
  const { user, isLoading, isLoggedIn } = useAuth();
  const { addToast } = useToast();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [historicalMessages, setHistoricalMessages] = useState<Message[]>([]);
  const [tiaProfile, setTiaProfile] = useState<TiaProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<TiaProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<string>("");
  const [forwarding, setForwarding] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert historical messages to UIMessage format for the AI SDK
  const convertToUIMessages = useCallback((messages: Message[]): UIMessage[] => {
    return messages.map((msg, index) => ({
      id: `hist-${msg.message_id}`,
      role: msg.sender_type === "user" ? "user" : "assistant",
      parts: [{ type: "text" as const, text: msg.content }],
      createdAt: new Date(msg.created_at),
    }));
  }, []);

  // AI Chat hook with streaming
  const {
    messages: aiMessages,
    sendMessage: sendAIMessage,
    status,
    setMessages: setAIMessages,
    error: aiError,
  } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isStreaming = status === "streaming" || status === "submitted";
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!user || Number.isNaN(conversationId)) return;

    const fetchData = async () => {
      setLoading(true);
      setLoadError("");

      const [convResponse, messagesResponse] = await Promise.all([
        getConversation(conversationId),
        getMessages(conversationId),
      ]);

      if (convResponse.data) {
        setConversation(convResponse.data);

        // Fetch TIA profile for system prompt
        const profilesResponse = await getTiaProfiles(user.user_id);
        if (profilesResponse.data) {
          setAllProfiles(profilesResponse.data);
          const profile = profilesResponse.data.find(
            (p: TiaProfile) => p.tia_profile_id === (convResponse.data as any)?.tia_profile_id
          );
          if (profile) {
            setTiaProfile(profile);
          }
        }
      }

      if (messagesResponse.data) {
        setHistoricalMessages(messagesResponse.data);
        // Initialize AI messages with historical messages
        const uiMessages = convertToUIMessages(messagesResponse.data);
        setAIMessages(uiMessages);
      }

      const firstError = convResponse.error || messagesResponse.error;
      if (firstError) {
        setLoadError(firstError);
        addToast(firstError, "error");
      }

      setLoading(false);
    };

    fetchData();
  }, [conversationId, user, addToast, setAIMessages, convertToUIMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isStreaming) {
      return;
    }

    const userMessage = input.trim();
    setInput("");

    // Save user message to backend
    await sendMessageToApi(conversationId, {
      content: userMessage,
      sender_type: "user",
      message_role: "user_query",
    });

    // Send to AI with context from the current TIA profile
    await sendAIMessage(
      { text: userMessage },
      {
        body: {
          systemPrompt: tiaProfile?.system_prompt,
          profileName: tiaProfile?.name,
          profileTone: tiaProfile?.tone,
          profileExpertise: tiaProfile?.expertise_area,
          conversationId,
          projectTitle: conversation?.project?.title,
          facultySupervisor: conversation?.project?.faculty_supervisor?.full_name,
        },
      }
    );

    inputRef.current?.focus();
  };

  // Save AI response to backend when streaming completes
  useEffect(() => {
    if (status === "ready" && aiMessages.length > 0) {
      const lastMessage = aiMessages[aiMessages.length - 1];
      // Check if it's an AI message that needs to be saved
      if (lastMessage.role === "assistant" && !lastMessage.id.startsWith("hist-")) {
        const textContent = lastMessage.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("") || "";

        if (textContent) {
          sendMessageToApi(conversationId, {
            content: textContent,
            sender_type: "tia",
            message_role: "tia_response",
          });
        }
      }
    }
  }, [status, aiMessages, conversationId]);

  const handleForwardToFaculty = async () => {
    if (!forwardingMessage.trim() || !conversation?.project?.faculty_supervisor) {
      return;
    }

    setForwarding(true);

    // Save forwarded message to backend
    const response = await sendMessageToApi(conversationId, {
      content: `[FORWARDED TO FACULTY: ${conversation.project.faculty_supervisor.full_name}]\n\n${forwardingMessage}`,
      sender_type: "user",
      message_role: "faculty_forward",
    });

    if (response.error) {
      addToast(response.error, "error");
    } else {
      addToast(
        `Question forwarded to ${conversation.project.faculty_supervisor.full_name}`,
        "success"
      );
      setShowForwardModal(false);
      setForwardingMessage("");

      // Add to UI messages
      setAIMessages((prev) => [
        ...prev,
        {
          id: `fwd-${Date.now()}`,
          role: "user" as const,
          parts: [
            {
              type: "text" as const,
              text: `[Forwarded to ${conversation.project?.faculty_supervisor?.full_name}]\n\n${forwardingMessage}`,
            },
          ],
          createdAt: new Date(),
        },
      ]);
    }

    setForwarding(false);
  };

  const handleSwitchProfile = (profileId: number) => {
    const newProfile = allProfiles.find((p) => p.tia_profile_id === profileId);
    if (newProfile) {
      setTiaProfile(newProfile);
      setShowProfileSelector(false);
      addToast(`Switched to ${newProfile.name} profile`, "success");
    }
  };

  const getMessageText = (message: UIMessage): string => {
    return (
      message.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") || ""
    );
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  if (loadError || !conversation) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-4">
          <Link
            href="/conversations"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Conversations
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            icon={<MessageSquare className="h-7 w-7 text-muted-foreground" />}
            title="Conversation Not Found"
            description={
              loadError || "The conversation you are looking for does not exist"
            }
            action={
              <Link href="/conversations">
                <Button variant="primary">Back to Conversations</Button>
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/conversations"
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Conversations
              </Link>
              <h1 className="text-xl font-bold text-foreground truncate">
                {conversation.title}
              </h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {tiaProfile && (
                  <button
                    onClick={() => setShowProfileSelector(!showProfileSelector)}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Settings className="h-3 w-3" />
                    {tiaProfile.name}
                  </button>
                )}
                {conversation.project?.faculty_supervisor && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {conversation.project.faculty_supervisor.full_name}
                  </span>
                )}
              </div>
            </div>
            {conversation.project?.faculty_supervisor && (
              <Button
                onClick={() => setShowForwardModal(true)}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                <Forward className="h-4 w-4" />
                Ask Faculty
              </Button>
            )}
          </div>
          
          {/* Profile Selector Dropdown */}
          {showProfileSelector && allProfiles.length > 0 && (
            <div className="mt-3 p-3 bg-secondary/50 rounded-xl border border-border animate-fade-in">
              <p className="text-xs text-muted-foreground mb-2 font-medium">
                Switch TIA Profile
              </p>
              <div className="grid gap-2">
                {allProfiles.map((profile) => (
                  <button
                    key={profile.tia_profile_id}
                    onClick={() => handleSwitchProfile(profile.tia_profile_id)}
                    className={`text-left p-3 rounded-lg transition-colors ${
                      tiaProfile?.tia_profile_id === profile.tia_profile_id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-secondary border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-foreground">
                        {profile.name}
                      </span>
                      {tiaProfile?.tia_profile_id === profile.tia_profile_id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {profile.tone} &bull; {profile.expertise_area || "General"}
                    </p>
                    {profile.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {profile.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {aiError && (
            <Alert
              type="error"
              message={aiError.message || "Failed to get response from TIA"}
              onClose={() => {}}
              className="mb-4"
            />
          )}

          {aiMessages.length === 0 ? (
            <div className="py-16 text-center animate-fade-in">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Start the conversation
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Send a message to TIA to get help with your research project
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {aiMessages.map((message, index) => {
                const messageText = getMessageText(message);
                const isForwarded = messageText.includes("[Forwarded to");
                const isFacultyForward = messageText.includes("[FORWARDED TO FACULTY");

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 animate-fade-in ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {message.role !== "user" && (
                      <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg shrink-0">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                    )}

                    <div
                      className={`max-w-[80%] lg:max-w-[70%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? isForwarded || isFacultyForward
                            ? "bg-amber-500/20 text-foreground border border-amber-500/30 rounded-br-md"
                            : "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-card border border-border text-foreground rounded-bl-md"
                      }`}
                    >
                      {message.role !== "user" && (
                        <p className="text-xs font-medium text-primary mb-1">
                          TIA
                        </p>
                      )}
                      {(isForwarded || isFacultyForward) && (
                        <p className="text-xs font-medium text-amber-600 mb-1 flex items-center gap-1">
                          <Forward className="h-3 w-3" />
                          Forwarded to Faculty
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {messageText.replace(/\[FORWARDED TO FACULTY:.*?\]\n\n/, "").replace(/\[Forwarded to.*?\]\n\n/, "")}
                      </p>
                      <p
                        className={`text-xs mt-2 ${
                          message.role === "user" && !isForwarded && !isFacultyForward
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {(message as any)?.createdAt
                          ? new Date((message as any)?.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </p>
                    </div>

                    {message.role === "user" && (
                      <div className="flex items-center justify-center w-8 h-8 bg-secondary rounded-lg shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Streaming indicator */}
              {isStreaming && (
                <div className="flex gap-3 justify-start animate-fade-in">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg shrink-0">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-card border border-border text-foreground rounded-2xl rounded-bl-md px-4 py-3">
                    <p className="text-xs font-medium text-primary mb-1">TIA</p>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Message Input */}
      <footer className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isStreaming}
              className="flex-1 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all disabled:opacity-60"
              autoFocus
            />
            <Button
              type="submit"
              disabled={isStreaming || !input.trim()}
              loading={isStreaming}
              variant="primary"
              className="px-4"
            >
              {!isStreaming && <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </footer>

      {/* Forward to Faculty Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg mx-4 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Forward Question to Faculty
              </h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setForwardingMessage("");
                }}
                className="p-1 rounded-md hover:bg-secondary text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Send a question directly to{" "}
              <span className="font-medium text-foreground">
                {conversation.project?.faculty_supervisor?.full_name}
              </span>{" "}
              for their expert input.
            </p>

            <textarea
              value={forwardingMessage}
              onChange={(e) => setForwardingMessage(e.target.value)}
              placeholder="Type your question for the faculty supervisor..."
              rows={4}
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all resize-none"
            />

            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleForwardToFaculty}
                disabled={forwarding || !forwardingMessage.trim()}
                loading={forwarding}
                variant="primary"
                fullWidth
              >
                <Forward className="h-4 w-4" />
                {forwarding ? "Forwarding..." : "Forward Question"}
              </Button>
              <Button
                onClick={() => {
                  setShowForwardModal(false);
                  setForwardingMessage("");
                }}
                variant="outline"
                disabled={forwarding}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
