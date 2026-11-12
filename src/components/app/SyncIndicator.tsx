import { useEffect } from "react";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  discardRejected,
  dismissRejected,
  retryRejected,
  syncNow,
  useSyncStatus,
} from "@/lib/offline";

/**
 * Quiet status chip: shown only while offline, while changes wait to sync, or
 * when the server refused a change. Refused changes are kept until you try
 * again or discard them, so nothing you entered disappears on its own.
 */
export function SyncIndicator({ className = "" }: { className?: string }) {
  const { online, pending, syncing, lastRejected, rejected } = useSyncStatus();

  useEffect(() => {
    if (!lastRejected) return;
    toast.error(lastRejected);
    dismissRejected();
  }, [lastRejected]);

  if (rejected.length) return <RejectedChanges className={className} />;
  if (online && pending === 0) return null;

  const changes = `${pending} ${pending === 1 ? "change" : "changes"}`;
  const label = !online
    ? pending > 0
      ? `Offline · ${changes} saved on this device`
      : "Offline · showing your saved copy"
    : syncing
      ? `Syncing ${changes}…`
      : `${changes} waiting to sync`;

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      disabled={!online || syncing}
      aria-live="polite"
      className={`tone-quiet inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-xs font-medium disabled:cursor-default ${className}`}
    >
      {online ? (
        <RefreshCw
          className={`size-3 shrink-0 ${syncing ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
      ) : (
        <CloudOff className="size-3 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}

function RejectedChanges({ className }: { className: string }) {
  const { online, syncing, rejected } = useSyncStatus();
  const count = `${rejected.length} ${rejected.length === 1 ? "change" : "changes"}`;
  return (
    <Popover>
      <PopoverTrigger
        aria-live="polite"
        className={`tone-warning inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
      >
        <TriangleAlert className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{count} not saved</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div>
          <p className="text-sm font-semibold">Not saved yet</p>
          <p className="text-sm text-muted-foreground">
            The server refused these. They're kept on this device until you try again or discard
            them.
          </p>
        </div>
        <ul className="space-y-2">
          {rejected.map((change) => (
            <li key={change.id} className="rounded-lg border border-border p-2.5">
              <p className="text-sm font-medium break-words">{change.what}</p>
              {change.why ? (
                <p className="mt-0.5 text-xs text-muted-foreground break-words">{change.why}</p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 mt-1 h-9 text-muted-foreground"
                onClick={() => void discardRejected(change.id)}
              >
                Discard
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          className="h-11 w-full"
          disabled={!online || syncing}
          onClick={() => void retryRejected()}
        >
          {online ? "Try again" : "Try again when online"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
