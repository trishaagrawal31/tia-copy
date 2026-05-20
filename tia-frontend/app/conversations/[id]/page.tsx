"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getConversation, getMessages, sendMessage } from "@/lib/api";
import {
  Alert,
  Button,
  LoadingSpinner,
  useToast,
  EmptyState,
} from "@/components";
import { Send, MessageSquare, ChevronLeft, User, Zap } from "lucide-react";

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

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = Number(params.id);
  const { user, isLoading, isLoggedIn } = useAuth();
  const { addToast } = useToast();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      }

      if (messagesResponse.data) {
        setMessages(messagesResponse.data);
      }

      const firstError = convResponse.error || messagesResponse.error;
      if (firstError) {
        setLoadError(firstError);
        addToast(firstError, "error");
      }

      setLoading(false);
    };

    fetchData();
  }, [conversationId, user, addToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newMessage.trim()) {
      return;
    }

    setSending(true);
    const response = await sendMessage<Message>(conversationId, {
      content: newMessage.trim(),
      sender_type: "user",
      message_role: "user_query",
    });

    if (response.error) {
      setError(response.error);
      addToast(response.error, "error");
      setSending(false);
      return;
    }

    const sentMessage = response.data;
    if (sentMessage) {
      setMessages((current) => [...current, sentMessage]);
      setNewMessage("");
      inputRef.current?.focus();
    }

    setSending(false);
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
            description={loadError || "The conversation you are looking for does not exist"}
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
          <Link
            href="/conversations"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Conversations
          </Link>
          <h1 className="text-xl font-bold text-foreground truncate">{conversation.title}</h1>
          {conversation.project?.faculty_supervisor && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <User className="h-4 w-4" />
              Faculty Supervisor: {conversation.project.faculty_supervisor.full_name}
            </p>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError("")}
              className="mb-4"
            />
          )}

          {messages.length === 0 ? (
            <div className="py-16 text-center animate-fade-in">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Start the conversation</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Send a message to TIA to get help with your research project
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.message_id}
                  className={`flex gap-3 animate-fade-in ${
                    message.sender_type === "user" ? "justify-end" : "justify-start"
                  }`}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {message.sender_type !== "user" && (
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg shrink-0">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] lg:max-w-[70%] rounded-2xl px-4 py-3 ${
                      message.sender_type === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border border-border text-foreground rounded-bl-md"
                    }`}
                  >
                    {message.sender_type !== "user" && (
                      <p className="text-xs font-medium text-primary mb-1 capitalize">
                        {message.sender_type}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {message.content}
                    </p>
                    <p
                      className={`text-xs mt-2 ${
                        message.sender_type === "user"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {message.sender_type === "user" && (
                    <div className="flex items-center justify-center w-8 h-8 bg-secondary rounded-lg shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
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
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={sending}
              className="flex-1 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all disabled:opacity-60"
              autoFocus
            />
            <Button
              type="submit"
              disabled={sending || !newMessage.trim()}
              loading={sending}
              variant="primary"
              className="px-4"
            >
              {!sending && <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </footer>
    </div>
  );
}
