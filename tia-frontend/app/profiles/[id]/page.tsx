"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getTiaProfiles, updateTiaProfile } from "@/lib/api";
import {
  Button,
  LoadingSpinner,
  Alert,
  useToast,
  AppLayout,
  PageHeader,
  PageContainer,
  Badge,
  EmptyState,
  Input,
  TextArea,
  Select,
  Checkbox,
} from "@/components";
import { AlertCircle, Pencil, X, Check } from "lucide-react";

interface TiaProfile {
  tia_profile_id: number;
  name: string;
  description: string | null;
  system_prompt: string;
  tone: string;
  expertise_area: string | null;
  is_default: boolean;
  user_id: number;
}

const TONE_OPTIONS = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "encouraging", label: "Encouraging" },
  { value: "critical", label: "Critical" },
  { value: "humorous", label: "Humorous" },
];

export default function ProfileDetailPage() {
  const router = useRouter();
  const params = useParams();
  const profileId = parseInt(params.id as string);
  const { user, isLoading, isLoggedIn } = useAuth();
  const { addToast } = useToast();

  const [profile, setProfile] = useState<TiaProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<TiaProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!user || Number.isNaN(profileId)) return;

    const fetchProfile = async () => {
      const response = await getTiaProfiles(user.user_id);
      if (response.data) {
        const found = response.data.find(
          (p: TiaProfile) => p.tia_profile_id === profileId
        );
        if (found) {
          setProfile(found);
          setFormData(found);
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user, profileId]);

  const handleSave = async () => {
    if (!user) return;

    if (!formData.name?.trim()) {
      setError("Profile name is required");
      return;
    }

    if (!formData.system_prompt?.trim()) {
      setError("System prompt is required");
      return;
    }

    setSaving(true);
    setError("");

    const response = await updateTiaProfile(user.user_id, profileId, {
      name: formData.name?.trim(),
      description: formData.description?.trim() || undefined,
      system_prompt: formData.system_prompt?.trim(),
      tone: formData.tone,
      expertise_area: formData.expertise_area?.trim() || undefined,
      is_default: formData.is_default,
    });

    if (response.error) {
      setError(response.error);
      addToast(response.error, "error");
      setSaving(false);
      return;
    }

    setProfile({ ...profile, ...formData } as TiaProfile);
    setIsEditing(false);
    setSaving(false);
    addToast("Profile updated successfully", "success");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <PageHeader title="Profile Not Found" backHref="/profiles" backLabel="Profiles" />
        <PageContainer>
          <EmptyState
            icon={<AlertCircle className="h-7 w-7 text-muted-foreground" />}
            title="Profile not found"
            description="The profile you are looking for does not exist or has been deleted"
            action={
              <Link href="/profiles">
                <Button variant="primary">Back to Profiles</Button>
              </Link>
            }
          />
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={isEditing ? "Edit Profile" : profile.name}
        backHref="/profiles"
        backLabel="Profiles"
        actions={
          !isEditing && (
            <div className="flex items-center gap-2">
              {profile.is_default && <Badge variant="success">Default</Badge>}
              <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>
          )
        }
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

            {isEditing ? (
              <div className="space-y-6">
                <Input
                  id="profile-name"
                  label="Profile Name"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />

                <Input
                  id="profile-description"
                  label="Description"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this profile"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Select
                    id="profile-tone"
                    label="Tone"
                    value={formData.tone || "formal"}
                    onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                    options={TONE_OPTIONS}
                    required
                  />

                  <Input
                    id="profile-expertise"
                    label="Expertise Area"
                    value={formData.expertise_area || ""}
                    onChange={(e) => setFormData({ ...formData, expertise_area: e.target.value })}
                    placeholder="e.g., Climate Science"
                  />
                </div>

                <TextArea
                  id="profile-system"
                  label="System Prompt"
                  value={formData.system_prompt || ""}
                  onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                  rows={8}
                  required
                />

                <Checkbox
                  id="profile-default"
                  label="Set as default profile"
                  checked={formData.is_default || false}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                />

                <div className="flex gap-3 pt-6 border-t border-border">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    loading={saving}
                    variant="primary"
                  >
                    <Check className="h-4 w-4" />
                    Save Changes
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditing(false);
                      setFormData(profile);
                      setError("");
                    }}
                    variant="ghost"
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Tone</p>
                  <p className="text-foreground capitalize">{profile.tone}</p>
                </div>

                {profile.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                    <p className="text-foreground">{profile.description}</p>
                  </div>
                )}

                {profile.expertise_area && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Expertise Area</p>
                    <p className="text-foreground">{profile.expertise_area}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">System Prompt</p>
                  <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                    <p className="text-sm text-foreground whitespace-pre-wrap font-mono">
                      {profile.system_prompt}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
