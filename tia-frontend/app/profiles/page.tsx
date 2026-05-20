"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getTiaProfiles, updateTiaProfile, deleteTiaProfile } from "@/lib/api";
import {
  Alert,
  Button,
  Input,
  Select,
  TextArea,
  LoadingSpinner,
  useToast,
  AppLayout,
  PageHeader,
  PageContainer,
  EmptyState,
  Badge,
} from "@/components";
import { UserCog, Plus, Pencil, Trash2, X, Check } from "lucide-react";

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

type EditData = {
  name: string;
  description: string;
  system_prompt: string;
  tone: string;
  expertise_area: string;
  is_default: boolean;
};

const TONE_OPTIONS = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "encouraging", label: "Encouraging" },
  { value: "critical", label: "Critical" },
  { value: "humorous", label: "Humorous" },
];

export default function ProfilesPage() {
  const router = useRouter();
  const { user, isLoading, isLoggedIn } = useAuth();
  const { addToast } = useToast();

  const [profiles, setProfiles] = useState<TiaProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<EditData>({
    name: "",
    description: "",
    system_prompt: "",
    tone: "formal",
    expertise_area: "",
    is_default: false,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn || !user) {
      if (isLoggedIn && !user) {
        // Have token but user data not loaded yet - stop loading state
        setLoading(false);
      }
      return;
    }

    const fetchProfiles = async () => {
      setLoading(true);
      setError("");

      const response = await getTiaProfiles(user.user_id);
      if (response.data) {
        setProfiles(response.data);
      } else if (response.error) {
        setError(response.error);
        addToast(response.error, "error");
      }

      setLoading(false);
    };

    fetchProfiles();
  }, [user, isLoggedIn, addToast]);

  const handleEdit = (profile: TiaProfile) => {
    setEditingId(profile.tia_profile_id);
    setEditData({
      name: profile.name,
      description: profile.description ?? "",
      system_prompt: profile.system_prompt,
      tone: profile.tone,
      expertise_area: profile.expertise_area ?? "",
      is_default: profile.is_default,
    });
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({
      name: "",
      description: "",
      system_prompt: "",
      tone: "formal",
      expertise_area: "",
      is_default: false,
    });
    setError("");
  };

  const handleSave = async (profileId: number) => {
    if (!user) return;

    if (!editData.name.trim()) {
      setError("Profile name is required");
      return;
    }

    if (!editData.system_prompt.trim()) {
      setError("System prompt is required");
      return;
    }

    setError("");
    setSaving(true);

    const response = await updateTiaProfile(user.user_id, profileId, {
      name: editData.name.trim(),
      description: editData.description.trim() || undefined,
      system_prompt: editData.system_prompt.trim(),
      tone: editData.tone,
      expertise_area: editData.expertise_area.trim() || undefined,
      is_default: editData.is_default,
    });

    if (response.error) {
      setError(response.error);
      addToast(response.error, "error");
      setSaving(false);
      return;
    }

    setProfiles((current) =>
      current.map((profile) =>
        profile.tia_profile_id === profileId
          ? {
              ...profile,
              name: editData.name.trim(),
              description: editData.description.trim() || null,
              system_prompt: editData.system_prompt.trim(),
              tone: editData.tone,
              expertise_area: editData.expertise_area.trim() || null,
              is_default: editData.is_default,
            }
          : profile
      )
    );
    setEditingId(null);
    setSaving(false);
    addToast("Profile updated", "success");
  };

  const handleDelete = async (profileId: number) => {
    if (!user) return;

    const confirmed = window.confirm("Are you sure you want to delete this profile?");
    if (!confirmed) return;

    const response = await deleteTiaProfile(user.user_id, profileId);

    if (response.error) {
      setError(response.error);
      addToast(response.error, "error");
      return;
    }

    setProfiles((current) => current.filter((profile) => profile.tia_profile_id !== profileId));
    addToast("Profile deleted", "success");
  };

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
        title="TIA Profiles"
        description="Manage assistant personalities and prompts"
        actions={
          <Link href="/profiles/new">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              New Profile
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
        ) : profiles.length === 0 ? (
          <EmptyState
            icon={<UserCog className="h-7 w-7 text-muted-foreground" />}
            title="No profiles yet"
            description="Create your first TIA profile to customize how your assistant behaves"
            action={
              <Link href="/profiles/new">
                <Button variant="primary">Create Your First Profile</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {profiles.map((profile, index) => (
              <div
                key={profile.tia_profile_id}
                className="card p-6 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {editingId === profile.tia_profile_id ? (
                  <div className="space-y-4">
                    <Input
                      id={`profile-name-${profile.tia_profile_id}`}
                      label="Name"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      required
                    />

                    <Select
                      id={`profile-tone-${profile.tia_profile_id}`}
                      label="Tone"
                      value={editData.tone}
                      onChange={(e) => setEditData({ ...editData, tone: e.target.value })}
                      options={TONE_OPTIONS}
                      required
                    />

                    <Input
                      id={`profile-expertise-${profile.tia_profile_id}`}
                      label="Expertise Area"
                      value={editData.expertise_area}
                      onChange={(e) => setEditData({ ...editData, expertise_area: e.target.value })}
                      placeholder="e.g., Climate Science"
                    />

                    <TextArea
                      id={`profile-system-${profile.tia_profile_id}`}
                      label="System Prompt"
                      value={editData.system_prompt}
                      onChange={(e) => setEditData({ ...editData, system_prompt: e.target.value })}
                      rows={5}
                      required
                    />

                    <label className="flex items-center gap-3 text-sm font-medium text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editData.is_default}
                        onChange={(e) => setEditData({ ...editData, is_default: e.target.checked })}
                        className="h-5 w-5 rounded border-2 border-input checked:bg-primary checked:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      />
                      Set as default profile
                    </label>

                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={() => handleSave(profile.tia_profile_id)}
                        variant="primary"
                        disabled={saving}
                        loading={saving}
                      >
                        <Check className="h-4 w-4" />
                        Save
                      </Button>
                      <Button onClick={handleCancelEdit} variant="ghost" disabled={saving}>
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-foreground truncate">
                          {profile.name}
                        </h2>
                        <p className="text-sm text-muted-foreground capitalize mt-0.5">
                          Tone: {profile.tone}
                        </p>
                      </div>
                      {profile.is_default && <Badge variant="success">Default</Badge>}
                    </div>

                    {profile.description && (
                      <p className="text-sm text-muted-foreground mb-3">{profile.description}</p>
                    )}

                    {profile.expertise_area && (
                      <p className="text-sm text-muted-foreground mb-3">
                        <span className="font-medium">Expertise:</span> {profile.expertise_area}
                      </p>
                    )}

                    <div className="p-3 bg-secondary/50 rounded-lg border border-border mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-1">System Prompt</p>
                      <p className="text-xs text-foreground line-clamp-3 font-mono">
                        {profile.system_prompt}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEdit(profile)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete(profile.tia_profile_id)}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
