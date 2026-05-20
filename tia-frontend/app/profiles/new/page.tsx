"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createTiaProfile } from "@/lib/api";
import {
  Input,
  Select,
  TextArea,
  Checkbox,
  Button,
  Alert,
  useToast,
  AppLayout,
  PageHeader,
  PageContainer,
  LoadingSpinner,
} from "@/components";

export default function NewProfilePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { addToast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [tone, setTone] = useState("formal");
  const [expertiseArea, setExpertiseArea] = useState("");
  const [isDefault, setIsDefault] = useState(false);
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
    if (!name.trim()) newErrors.name = "Profile name is required";
    if (!systemPrompt.trim()) newErrors.systemPrompt = "System prompt is required";
    if (systemPrompt.length < 20)
      newErrors.systemPrompt = "System prompt should be at least 20 characters";
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

    const response = await createTiaProfile(user.user_id, {
      name,
      description,
      system_prompt: systemPrompt,
      tone,
      expertise_area: expertiseArea,
      is_default: isDefault,
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

    addToast("Profile created successfully!", "success");
    router.push("/profiles");
  };

  return (
    <AppLayout>
      <PageHeader
        title="Create TIA Profile"
        description="Define a personality and behavior for your AI assistant"
        backHref="/profiles"
        backLabel="Profiles"
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
                id="profile-name"
                label="Profile Name"
                type="text"
                placeholder="e.g., Research Assistant, Mentor, Critic"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: "" });
                }}
                error={errors.name}
                helperText="Give your AI assistant a distinctive name"
                required
              />

              <Input
                id="profile-description"
                label="Description"
                type="text"
                placeholder="Brief description of this profile"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                helperText="A short summary of what this profile does"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Select
                  id="profile-tone"
                  label="Tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  options={[
                    { value: "formal", label: "Formal" },
                    { value: "casual", label: "Casual" },
                    { value: "encouraging", label: "Encouraging" },
                    { value: "critical", label: "Critical" },
                    { value: "humorous", label: "Humorous" },
                  ]}
                  helperText="How should this profile communicate?"
                  required
                />

                <Input
                  id="profile-expertise"
                  label="Expertise Area"
                  type="text"
                  placeholder="e.g., Climate Science"
                  value={expertiseArea}
                  onChange={(e) => setExpertiseArea(e.target.value)}
                  helperText="Area of specialization"
                />
              </div>

              <TextArea
                id="profile-systemprompt"
                label="System Prompt"
                placeholder="Define how this AI assistant should behave, what expertise it has, and how it should communicate..."
                value={systemPrompt}
                onChange={(e) => {
                  setSystemPrompt(e.target.value);
                  if (errors.systemPrompt) setErrors({ ...errors, systemPrompt: "" });
                }}
                error={errors.systemPrompt}
                rows={8}
                helperText="Example: 'You are a supportive research mentor with expertise in environmental science. Help students by asking clarifying questions and suggesting next steps.'"
                required
              />

              <div className="pt-4 border-t border-border">
                <Checkbox
                  id="profile-default"
                  label="Set as default profile"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                <p className="text-xs text-muted-foreground mt-2 ml-8">
                  This profile will be selected by default in new conversations
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
                <Button
                  type="submit"
                  disabled={loading}
                  loading={loading}
                  variant="primary"
                  className="flex-1"
                >
                  {loading ? "Creating..." : "Create Profile"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/profiles")}
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
