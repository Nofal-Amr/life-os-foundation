import { useEffect } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { dismissRejected, syncNow, useSyncStatus } from "@/lib/offline";

/** Quiet status chip: shown only while offline or while changes wait to sync. */
export function SyncIndicator({ className = "" }: { className?: string }) {
  const { online, pending, syncing, lastRejected } = useSyncStatus();

  useEffect(() => {
    if (!lastRejected) return;
    toast.error(lastRejected);
    dismissRejected();
  }, [lastRejected]);

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
