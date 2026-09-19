import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { ErrorState, LoadingState } from "@/components/app/States";
import { UserAvatar, useDisplayName } from "@/components/app/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_DIMENSION_ORDER,
  dimensionLabel,
  preferencesKeys,
  preferencesQuery,
  saveDimensionOrder,
} from "@/data/preferences";
import {
  ACCEPTED_AVATAR_TYPES,
  profileKeys,
  profileQuery,
  removeAvatar,
  updateProfile,
  uploadAvatar,
} from "@/data/profile";
import { useTheme } from "@/hooks/useTheme";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Profile & Settings — Life OS" },
      {
        name: "description",
        content: "Set your display name, profile picture, dimension priorities and theme.",
      },
      { property: "og:title", content: "Profile & Settings — Life OS" },
      {
        property: "og:description",
        content: "Set your display name, profile picture, dimension priorities and theme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const profile = useQuery(profileQuery());
  const preferences = useQuery(preferencesQuery());
  const { email } = useDisplayName();
  const { theme, toggleTheme } = useTheme();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [order, setOrder] = useState<string[]>(DEFAULT_DIMENSION_ORDER);

  useEffect(() => {
    if (profile.data) setName(profile.data.display_name ?? "");
  }, [profile.data]);

  useEffect(() => {
    const saved = preferences.data?.dimension_order;
    if (saved && saved.length > 0) setOrder(saved);
  }, [preferences.data]);

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const invalidateProfile = () => queryClient.invalidateQueries({ queryKey: profileKeys.current });

  const saveName = useMutation({
    mutationFn: () => updateProfile({ display_name: name.trim() || null }),
    onSuccess: () => {
      invalidateProfile();
      toast.success("Display name saved.");
    },
    onError,
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => {
      invalidateProfile();
      toast.success("Profile picture updated.");
    },
    onError,
  });

  const clearPicture = useMutation({
    mutationFn: () => removeAvatar(),
    onSuccess: () => {
      invalidateProfile();
      toast.success("Profile picture removed.");
    },
    onError,
  });

  const saveOrder = useMutation({
    mutationFn: (next: string[]) => saveDimensionOrder(next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: preferencesKeys.current });
      toast.success("Priority order saved.");
    },
    onError,
  });

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const current = next[index]!;
    next[index] = next[target]!;
    next[target] = current;
    setOrder(next);
  }

  if (profile.isLoading || preferences.isLoading) {
    return (
      <>
        <PageHeader title="Profile & Settings" description="How the system knows you." />
        <LoadingState rows={4} />
      </>
    );
  }

  if (profile.error || preferences.error) {
    return (
      <>
        <PageHeader title="Profile & Settings" description="How the system knows you." />
        <ErrorState
          error={profile.error ?? preferences.error}
          onRetry={() => {
            profile.refetch();
            preferences.refetch();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Profile & Settings"
        description="How the system knows you, and how it looks."
      />

      <div className="space-y-6">
        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
            <CardDescription>Your name is used across the app instead of your email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <UserAvatar size="lg" />
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={upload.isPending}
                    onClick={() => fileInput.current?.click()}
                  >
                    {upload.isPending
                      ? "Uploading…"
                      : profile.data?.avatar_url
                        ? "Replace picture"
                        : "Upload picture"}
                  </Button>
                  {profile.data?.avatar_url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={clearPicture.isPending}
                      onClick={() => clearPicture.mutate()}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  PNG, JPEG, WebP or GIF, up to 2MB. Without a picture, your initials are shown.
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPTED_AVATAR_TYPES.join(",")}
                  className="sr-only"
                  aria-label="Choose a profile picture"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) upload.mutate(file);
                  }}
                />
              </div>
            </div>

            <form
              className="grid gap-4 sm:max-w-md"
              onSubmit={(event) => {
                event.preventDefault();
                saveName.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  value={name}
                  placeholder="Your name"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-email">Account email</Label>
                <Input id="account-email" value={email} readOnly disabled />
              </div>
              <div>
                <Button type="submit" disabled={saveName.isPending}>
                  {saveName.isPending ? "Saving…" : "Save name"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Dimension priority</CardTitle>
            <CardDescription>
              The order your life dimensions matter to you right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-2">
              {order.map((dimension, index) => (
                <li
                  key={dimension}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="flex items-center gap-3 text-sm">
                    <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                    {dimensionLabel(dimension)}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${dimensionLabel(dimension)} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${dimensionLabel(dimension)} down`}
                      disabled={index === order.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              disabled={saveOrder.isPending}
              onClick={() => saveOrder.mutate(order)}
            >
              {saveOrder.isPending ? "Saving…" : "Save order"}
            </Button>
          </CardContent>
        </Card>

        <Card className="system-card">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Your theme choice is remembered on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={toggleTheme}>
              {theme === "dark" ? (
                <Sun className="size-4" aria-hidden="true" />
              ) : (
                <Moon className="size-4" aria-hidden="true" />
              )}
              {theme === "dark" ? "Switch to light" : "Switch to dark"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
