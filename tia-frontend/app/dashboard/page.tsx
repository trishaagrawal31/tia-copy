"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getProjects, getTiaProfiles } from "@/lib/api";
import {
  Button,
  LoadingSpinner,
  Alert,
  useToast,
  AppLayout,
  PageHeader,
  PageContainer,
  EmptyState,
  Badge,
} from "@/components";
import {
  FolderKanban,
  Plus,
  Calendar,
  MessageSquare,
  UserCog,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface Project {
  project_id: number;
  title: string;
  description: string | null;
  status: string;
  main_deadline: string | null;
  owner_user_id: number;
  course_code: string | null;
}

interface TiaProfile {
  tia_profile_id: number;
  name: string;
  tone: string;
  is_default: boolean;
}

const STATUS_VARIANTS: Record<string, "success" | "warning" | "info" | "secondary" | "default"> = {
  active: "success",
  in_progress: "success",
  planning: "info",
  submitted: "info",
  completed: "success",
  archived: "secondary",
};

const formatStatus = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { addToast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tiaProfiles, setTiaProfiles] = useState<TiaProfile[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");
  const [profilesError, setProfilesError] = useState("");
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user) {
      const fetchProjects = async () => {
        setProjectsError("");
        const response = await getProjects();
        if (response.error) {
          // Provide more helpful error messages based on status
          if (response.status === 0) {
            setProjectsError("Cannot connect to the backend server. Please ensure it's running on http://localhost:8000");
          } else if (response.status !== 401) {
            // Don't show error for 401 - auth context handles redirect
            setProjectsError(response.error);
          }
        } else if (response.data) {
          setProjects(response.data);
        }
        setProjectsLoading(false);
      };

      const fetchProfiles = async () => {
        setProfilesError("");
        const response = await getTiaProfiles(user.user_id);
        if (response.error) {
          if (response.status === 0) {
            setProfilesError("Cannot connect to the backend server.");
          } else if (response.status !== 401) {
            // Don't show error for 401 - auth context handles redirect
            setProfilesError(response.error);
          }
        } else if (response.data) {
          setTiaProfiles(response.data);
        }
        setProfilesLoading(false);
      };

      fetchProjects();
      fetchProfiles();
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <PageHeader
        title={`Welcome back, ${user.first_name}`}
        description="Here&apos;s an overview of your research activity"

      />

      <PageContainer>
        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10">
          <div className="card p-5 lg:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm lg:text-base font-medium text-muted-foreground">Projects</p>
                <p className="text-2xl lg:text-3xl font-bold text-foreground mt-1">
                  {projectsLoading ? "-" : projects.length}
                </p>
              </div>
              <div className="flex items-center justify-center w-11 h-11 lg:w-12 lg:h-12 bg-primary/10 rounded-xl">
                <FolderKanban className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="card p-5 lg:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm lg:text-base font-medium text-muted-foreground">Active</p>
                <p className="text-2xl lg:text-3xl font-bold text-foreground mt-1">
                  {projectsLoading
                    ? "-"
                    : projects.filter((p) => p.status === "in_progress" || p.status === "planning").length}
                </p>
              </div>
              <div className="flex items-center justify-center w-11 h-11 lg:w-12 lg:h-12 bg-emerald-50 rounded-xl">
                <Sparkles className="h-5 w-5 lg:h-6 lg:w-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="card p-5 lg:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm lg:text-base font-medium text-muted-foreground">TIA Profiles</p>
                <p className="text-2xl lg:text-3xl font-bold text-foreground mt-1">
                  {profilesLoading ? "-" : tiaProfiles.length}
                </p>
              </div>
              <div className="flex items-center justify-center w-11 h-11 lg:w-12 lg:h-12 bg-violet-50 rounded-xl">
                <UserCog className="h-5 w-5 lg:h-6 lg:w-6 text-violet-600" />
              </div>
            </div>
          </div>

          <div className="card p-5 lg:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm lg:text-base font-medium text-muted-foreground">Due Soon</p>
                <p className="text-2xl lg:text-3xl font-bold text-foreground mt-1">
                  {projectsLoading
                    ? "-"
                    : projects.filter((p) => {
                        if (!p.main_deadline) return false;
                        const deadline = new Date(p.main_deadline);
                        const now = new Date();
                        const diff = deadline.getTime() - now.getTime();
                        return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
                      }).length}
                </p>
              </div>
              <div className="flex items-center justify-center w-11 h-11 lg:w-12 lg:h-12 bg-amber-50 rounded-xl">
                <Calendar className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Projects Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg lg:text-xl font-semibold text-foreground">Recent Projects</h2>
              <Link href="/projects/new">
                <Button variant="primary" size="sm">
                  <Plus className="h-4 w-4" />
                  New Project
                </Button>
              </Link>
            </div>

            {projectsError && (
              <Alert
                type="error"
                message={projectsError}
                onClose={() => setProjectsError("")}
              />
            )}

            {projectsLoading ? (
              <div className="card p-12 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={<FolderKanban className="h-8 w-8 text-muted-foreground" />}
                title="No projects yet"
                description="Create your first project to start collaborating with TIA"
                action={
                  <Link href="/projects/new">
                    <Button variant="primary">Create Your First Project</Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-4">
                {projects.slice(0, 5).map((project, index) => (
                  <Link
                    key={project.project_id}
                    href={`/projects/${project.project_id}`}
                    className="block"
                  >
                    <div
                      className="card card-hover p-5 lg:p-6 animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-base lg:text-lg text-foreground truncate group-hover:text-primary transition-colors">
                            {project.title}
                          </h3>
                          {project.description && (
                            <p className="text-sm lg:text-base text-muted-foreground mt-1.5 line-clamp-2">
                              {project.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
                            {project.course_code && <span>{project.course_code}</span>}
                            {project.main_deadline && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Due {new Date(project.main_deadline).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant={STATUS_VARIANTS[project.status] || "secondary"}>
                          {formatStatus(project.status)}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}

                {projects.length > 5 && (
                  <Link href="/projects" className="block">
                    <div className="card p-4 lg:p-5 text-center hover:bg-secondary/50 transition-colors">
                      <span className="text-base font-medium text-primary flex items-center justify-center gap-1">
                        View all {projects.length} projects
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* TIA Profiles */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg lg:text-xl font-semibold text-foreground">TIA Profiles</h2>
                <Link href="/profiles/new">
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {profilesError && (
                <Alert
                  type="error"
                  message={profilesError}
                  onClose={() => setProfilesError("")}
                  className="mb-4"
                />
              )}

              {profilesLoading ? (
                <div className="card p-8 flex items-center justify-center">
                  <LoadingSpinner size="sm" />
                </div>
              ) : tiaProfiles.length === 0 ? (
                <EmptyState
                  icon={<UserCog className="h-7 w-7 text-muted-foreground" />}
                  title="No profiles yet"
                  description="Create a TIA profile to customize your assistant"
                  action={
                    <Link href="/profiles/new">
                      <Button variant="primary" size="sm">Create Profile</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {tiaProfiles.slice(0, 4).map((profile) => (
                    <Link
                      key={profile.tia_profile_id}
                      href={`/profiles/${profile.tia_profile_id}`}
                    >
                      <div className="card card-hover p-4 lg:p-5">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <h3 className="font-medium text-base text-foreground truncate">
                              {profile.name}
                            </h3>
                            <p className="text-sm text-muted-foreground capitalize mt-0.5">
                              {profile.tone}
                            </p>
                          </div>
                          {profile.is_default && (
                            <Badge variant="success">Default</Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div>
              <h2 className="text-lg lg:text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link href="/conversations">
                  <div className="card card-hover p-4 lg:p-5 flex items-center gap-4">
                    <div className="flex items-center justify-center w-11 h-11 bg-primary/10 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-base text-foreground">Conversations</p>
                      <p className="text-sm text-muted-foreground">Chat with TIA</p>
                    </div>
                  </div>
                </Link>

                <Link href="/profiles">
                  <div className="card card-hover p-4 lg:p-5 flex items-center gap-4">
                    <div className="flex items-center justify-center w-11 h-11 bg-violet-50 rounded-lg">
                      <UserCog className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-medium text-base text-foreground">Manage Profiles</p>
                      <p className="text-sm text-muted-foreground">Customize TIA</p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
