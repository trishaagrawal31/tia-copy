"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createProject } from "@/lib/api";
import {
  Input,
  Select,
  TextArea,
  Button,
  Alert,
  useToast,
  AppLayout,
  PageHeader,
  PageContainer,
  LoadingSpinner,
} from "@/components";

export default function NewProjectPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { addToast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [status, setStatus] = useState("planning");
  const [mainDeadline, setMainDeadline] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Project title is required";
    if (!status) newErrors.status = "Status is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrors({});

    if (!validateForm()) {
      addToast("Please fill in all required fields", "warning");
      return;
    }

    setLoading(true);

    const response = await createProject({
      title,
      description,
      course_code: courseCode,
      status,
      main_deadline: mainDeadline || undefined,
    });

    if (response.error) {
      // Provide more helpful error messages
      if (response.status === 0) {
        setError("Cannot connect to the backend server. Please ensure it's running on http://localhost:8000");
      } else if (response.status !== 401) {
        // Don't show error for 401 - auth context handles redirect
        setError(response.error);
        addToast(response.error, "error");
      }
      setLoading(false);
      return;
    }

    addToast("Project created successfully!", "success");
    router.push("/projects");
  };

  return (
    <AppLayout>
      <PageHeader
        title="Create New Project"
        description="Set up a new research project and start collaborating"
        backHref="/projects"
        backLabel="Projects"
      />

      <PageContainer>
        <div className="max-w-2xl">
          <div className="card p-6 sm:p-8">
            {error && (
              <Alert
                type="error"
                message={error}
                onClose={() => setError("")}
                className="mb-6"
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                id="project-title"
                label="Project Title"
                type="text"
                placeholder="e.g., Climate Change Mitigation Research"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors({ ...errors, title: "" });
                }}
                error={errors.title}
                required
              />

              <TextArea
                id="project-description"
                label="Description"
                placeholder="Describe your research project, objectives, and scope..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                helperText="Provide context about what this project entails"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Input
                  id="project-coursecode"
                  label="Course Code"
                  type="text"
                  placeholder="e.g., CS 401"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  helperText="Optional: Associate with a course"
                />

                <Select
                  id="project-status"
                  label="Status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  error={errors.status}
                  options={[
                    { value: "planning", label: "Planning" },
                    { value: "in_progress", label: "In Progress" },
                    { value: "submitted", label: "Submitted" },
                    { value: "completed", label: "Completed" },
                    { value: "archived", label: "Archived" },
                  ]}
                  required
                />
              </div>

              <Input
                id="project-deadline"
                label="Main Deadline"
                type="date"
                value={mainDeadline}
                onChange={(e) => setMainDeadline(e.target.value)}
                helperText="Optional: Set a target completion date"
              />

              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
                <Button
                  type="submit"
                  disabled={loading}
                  loading={loading}
                  variant="primary"
                  className="flex-1"
                >
                  {loading ? "Creating..." : "Create Project"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/projects")}
                  className="flex-1 sm:flex-initial"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
