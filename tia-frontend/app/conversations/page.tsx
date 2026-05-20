"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  getConversations,
  getTiaProfiles,
  getProjects,
  createConversation,
} from "@/lib/api";
import {
  Alert,
  Button,
  LoadingSpinner,
  Select,
  Input,
  useToast,
  AppLayout,
  PageHeader,
  PageContainer,
  EmptyState,
} from "@/components";
import { MessageSquare, Plus, X, ArrowRight, User } from "lucide-react";

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
  is_archived: boolean;
  created_at: string;
  project?: ProjectSummary | null;
}

interface Project {
  project_id: number;
  title: string;
}

interface TiaProfile {
  tia_profile_id: number;
  name: string;
}

export default function ConversationsPage() {
  const router = useRouter();
  const { user, isLoading, isLoggedIn } = useAuth();
  const { addToast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tiaProfiles, setTiaProfiles] = useState<TiaProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newConvTitle, setNewConvTitle] = useState("");
  const [newConvProjectId, setNewConvProjectId] = useState<string>("");
  const [newConvProfileId, setNewConvProfileId] = useState<string>("");
  const [newConvError, setNewConvError] = useState("");
  const [creatingConv, setCreatingConv] = useState(false);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("project_id");

    if (projectId) {
      window.setTimeout(() => {
        setShowNewForm(true);
        setNewConvProjectId(projectId);
      }, 0);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      const [convResponse, projResponse, profileResponse] = await Promise.all([
        getConversations(),
        getProjects(),
        getTiaProfiles(user.user_id),
      ]);

      if (convResponse.data) setConversations(convResponse.data);
      if (projResponse.data) setProjects(projResponse.data);
      if (profileResponse.data) setTiaProfiles(profileResponse.data);

      const firstError = convResponse.error || projResponse.error || profileResponse.error;
      if (firstError) {
        addToast(firstError, "error");
      }

      setLoading(false);
    };

    fetchData();
  }, [user, addToast]);

  const activeConversations = useMemo(
    () => conversations.filter((conversation) => !conversation.is_archived),
    [conversations]
  );

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewConvError("");

    if (!newConvTitle.trim()) {
      setNewConvError("Conversation title is required");
      return;
    }

    if (!newConvProjectId) {
      setNewConvError("Please select a project");
      return;
    }

    if (!newConvProfileId) {
      setNewConvError("Please select a TIA profile");
      return;
    }

    setCreatingConv(true);
    const response = await createConversation({
      title: newConvTitle.trim(),
      project_id: Number(newConvProjectId),
      tia_profile_id: Number(newConvProfileId),
    });

    if (response.error) {
      setNewConvError(response.error);
      addToast(response.error, "error");
      setCreatingConv(false);
      return;
    }

    if (response.data?.conversation_id) {
      addToast("Conversation created", "success");
      router.push(`/conversations/${response.data.conversation_id}`);
      return;
    }

    setNewConvError("Conversation created but no ID was returned");
    setCreatingConv(false);
  };

  const getProjectName = (pid: number) =>
    projects.find((project) => project.project_id === pid)?.title || `Project ${pid}`;

  const getProfileName = (pid: number) =>
    tiaProfiles.find((profile) => profile.tia_profile_id === pid)?.name || `Profile ${pid}`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Conversations"
        description="Continue chats or start a new discussion with TIA"
        actions={
          <Button
            onClick={() => setShowNewForm(!showNewForm)}
            variant={showNewForm ? "outline" : "primary"}
          >
            {showNewForm ? (
              <>
                <X className="h-4 w-4" />
                Close
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                New Conversation
              </>
            )}
          </Button>
        }
      />

      <PageContainer>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Conversations List */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="card p-12 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : activeConversations.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-7 w-7 text-muted-foreground" />}
                title="No conversations yet"
                description="Start a conversation with TIA to get help with your research"
                action={
                  <Button onClick={() => setShowNewForm(true)} variant="primary">
                    Start a Conversation
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {activeConversations.map((conversation, index) => (
                  <Link
                    key={conversation.conversation_id}
                    href={`/conversations/${conversation.conversation_id}`}
                    className="block"
                  >
                    <article
                      className="card card-hover p-5 animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h2 className="font-semibold text-foreground truncate">
                            {conversation.title}
                          </h2>
                          <p className="text-sm text-muted-foreground mt-1">
                            {getProjectName(conversation.project_id)} &bull;{" "}
                            {getProfileName(conversation.tia_profile_id)}
                          </p>
                          {conversation.project?.faculty_supervisor && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Faculty: {conversation.project.faculty_supervisor.full_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {new Date(conversation.created_at).toLocaleDateString()}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* New Conversation Form */}
          <div>
            {showNewForm && (
              <div className="card p-6 animate-fade-in sticky top-24">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Start New Conversation
                </h2>

                {newConvError && (
                  <Alert
                    type="error"
                    message={newConvError}
                    onClose={() => setNewConvError("")}
                    className="mb-4"
                  />
                )}

                <form onSubmit={handleCreateConversation} className="space-y-4">
                  <Input
                    id="conversation-title"
                    label="Title"
                    type="text"
                    placeholder="e.g., Research methodology discussion"
                    value={newConvTitle}
                    onChange={(e) => setNewConvTitle(e.target.value)}
                    required
                  />

                  <Select
                    id="conversation-project"
                    label="Project"
                    value={newConvProjectId}
                    onChange={(e) => setNewConvProjectId(e.target.value)}
                    required
                    options={projects.map((project) => ({
                      value: String(project.project_id),
                      label: project.title,
                    }))}
                  />

                  <Select
                    id="conversation-profile"
                    label="TIA Profile"
                    value={newConvProfileId}
                    onChange={(e) => setNewConvProfileId(e.target.value)}
                    required
                    options={tiaProfiles.map((profile) => ({
                      value: String(profile.tia_profile_id),
                      label: profile.name,
                    }))}
                  />

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="submit"
                      loading={creatingConv}
                      disabled={creatingConv}
                      variant="primary"
                      fullWidth
                    >
                      {creatingConv ? "Starting..." : "Start Conversation"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {!showNewForm && (
              <div className="card p-6">
                <h2 className="font-semibold text-foreground mb-2">Quick Actions</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Start a new conversation or open the form above
                </p>
                <Button
                  onClick={() => setShowNewForm(true)}
                  variant="primary"
                  fullWidth
                >
                  <Plus className="h-4 w-4" />
                  New Conversation
                </Button>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
