"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getProjects } from "@/lib/api";
import {
  Alert,
  Button,
  LoadingSpinner,
  useToast,
  AppLayout,
  PageHeader,
  PageContainer,
  EmptyState,
  Badge,
} from "@/components";
import { FolderKanban, Plus, Calendar } from "lucide-react";

interface Project {
  project_id: number;
  title: string;
  description: string | null;
  status: string;
  main_deadline: string | null;
  course_code: string | null;
}

const STATUS_VARIANTS: Record<string, "success" | "warning" | "info" | "secondary" | "default"> = {
  planning: "info",
  in_progress: "success",
  submitted: "info",
  completed: "success",
  archived: "secondary",
};

const formatStatus = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ProjectsPage() {
  const router = useRouter();
  const { user, isLoading, isLoggedIn } = useAuth();
  const { addToast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }

    const fetchProjects = async () => {
      setLoading(true);
      setError("");

      const response = await getProjects();
      if (response.data) {
        setProjects(response.data);
      } else if (response.error) {
        setError(response.error);
        addToast(response.error, "error");
      }

      setLoading(false);
    };

    fetchProjects();
  }, [isLoggedIn, addToast]);

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
        title="Projects"
        description="Manage your research projects and track progress"
        actions={
          <Link href="/projects/new">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        }
      />

      <PageContainer>
        {error && (
          <Alert type="error" message={error} onClose={() => setError("")} className="mb-6" />
        )}

        {loading ? (
          <div className="card p-12 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-7 w-7 text-muted-foreground" />}
            title="No projects yet"
            description="Create your first project to start collaborating with TIA on your research"
            action={
              <Link href="/projects/new">
                <Button variant="primary">Create Your First Project</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {projects.map((project, index) => (
              <Link
                key={project.project_id}
                href={`/projects/${project.project_id}`}
                className="block"
              >
                <article
                  className="card card-hover p-6 h-full animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-foreground truncate text-lg">
                        {project.title}
                      </h2>
                      {project.course_code && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {project.course_code}
                        </p>
                      )}
                    </div>
                    <Badge variant={STATUS_VARIANTS[project.status] || "secondary"}>
                      {formatStatus(project.status)}
                    </Badge>
                  </div>

                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {project.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-4 border-t border-border">
                    <span className="text-primary font-medium">Open workspace</span>
                    {project.main_deadline ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Due {new Date(project.main_deadline).toLocaleDateString()}
                      </span>
                    ) : (
                      <span>No deadline set</span>
                    )}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
