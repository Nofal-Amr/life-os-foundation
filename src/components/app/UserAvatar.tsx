import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { avatarUrlQuery, profileQuery } from "@/data/profile";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-9 text-xs",
  lg: "size-20 text-xl",
} as const;

/** Display name from the saved profile, falling back to the account email. */
export function useDisplayName() {
  const { user } = useAuth();
  const profile = useQuery(profileQuery());
  const displayName =
    profile.data?.display_name?.trim() || user?.email?.split("@")[0] || "there";
  return {
    displayName,
    firstName: displayName.split(/\s+/)[0] ?? displayName,
    email: user?.email ?? "",
    avatarPath: profile.data?.avatar_url ?? null,
  };
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "LO";
}

/**
 * Shared avatar: the uploaded picture when set, otherwise a calm
 * initials badge built from the app's design tokens.
 */
export function UserAvatar({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { displayName, avatarPath } = useDisplayName();
  const signed = useQuery(avatarUrlQuery(avatarPath));
  const initials = initialsOf(displayName);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card font-semibold text-foreground",
        SIZES[size],
        className,
      )}
      title={displayName}
      aria-label={`Signed in as ${displayName}`}
    >
      {signed.data ? (
        <img
          src={signed.data}
          alt=""
          className="size-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
