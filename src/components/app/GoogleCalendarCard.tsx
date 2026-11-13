/**
 * Google Calendar sync controls: the full card for Settings and a compact bar
 * for the Calendar page. Until the owner sets up the Google client and the
 * database change, both just say "Not set up yet".
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { CalendarSync, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { eventKeys } from "@/data/events";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  listGoogleCalendars,
  saveGoogleCalendarChoice,
  startGoogleConnect,
  syncGoogleCalendarNow,
  type GoogleCalendarStatus,
} from "@/lib/googleCalendar.functions";
import { isDemo } from "@/lib/demo";
import { createPkcePair, PKCE_STORAGE_KEY } from "@/lib/google/pkce";

const statusKey = ["google-calendar", "status"] as const;
const AUTO_SYNC_AFTER_MS = 10 * 60_000;

function useGoogleStatus() {
  return useQuery({
    queryKey: statusKey,
    queryFn: async (): Promise<GoogleCalendarStatus> => {
      if (isDemo()) return { state: "not_configured" };
      try {
        return await getGoogleCalendarStatus();
      } catch {
        // Offline or the server isn't ready: say "not set up" rather than break the page.
        return { state: "not_configured" };
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

function useSyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncGoogleCalendarNow(),
    onSuccess: (r) => {
      if (!r.skipped) toast[r.ok ? "success" : "message"](r.message);
      void qc.invalidateQueries({ queryKey: statusKey });
      void qc.invalidateQueries({ queryKey: eventKeys.all });
    },
    onError: () => toast.message("Sync didn't finish. It will try again next time."),
  });
}

async function connect() {
  try {
    const { verifier, challenge } = await createPkcePair();
    sessionStorage.setItem(PKCE_STORAGE_KEY, verifier);
    const { url } = await startGoogleConnect({ data: { codeChallenge: challenge } });
    window.location.assign(url);
  } catch {
    toast.error("Couldn't open Google. Try again in a moment.");
  }
}

function lastSynced(iso: string | null) {
  return iso
    ? `Last synced ${formatDistanceToNow(new Date(iso), { addSuffix: true })}.`
    : "Not synced yet.";
}

/** Settings → Google Calendar. */
export function GoogleCalendarCard() {
  const status = useGoogleStatus();
  const s = status.data;
  return (
    <section className="stat-card space-y-4 p-5" aria-labelledby="gcal-title">
      <div>
        <p id="gcal-title" className="flex items-center gap-2 text-base font-semibold">
          <CalendarSync className="size-4" /> Google Calendar
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Two-way sync of events with the Google calendars you choose. Life OS can read and change
          events and see your calendar names, nothing else. Details in the{" "}
          <Link to="/privacy" className="underline">
            privacy policy
          </Link>
          .
        </p>
      </div>
      {!s || s.state === "not_configured" ? (
        <p className="text-sm text-muted-foreground">Not set up yet.</p>
      ) : s.state === "disconnected" ? (
        <Button onClick={() => void connect()}>Connect Google Calendar</Button>
      ) : (
        <Connected status={s} />
      )}
    </section>
  );
}

function Connected({ status }: { status: Extract<GoogleCalendarStatus, { state: "connected" }> }) {
  const [choosing, setChoosing] = useState(!status.syncEnabled);
  const [leaving, setLeaving] = useState(false);
  const sync = useSyncNow();
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Connected{status.email ? ` as ${status.email}` : ""}.{" "}
        {status.syncEnabled ? lastSynced(status.lastSyncAt) : null}
      </p>
      {status.lastError ? (
        <p className="text-sm text-muted-foreground">{status.lastError}</p>
      ) : null}
      {choosing ? (
        <CalendarPicker status={status} onDone={() => setChoosing(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className={sync.isPending ? "size-4 animate-spin" : "size-4"} /> Sync now
          </Button>
          <Button variant="outline" onClick={() => setChoosing(true)}>
            Change calendars
          </Button>
          <Button variant="ghost" onClick={() => setLeaving(true)}>
            Disconnect
          </Button>
        </div>
      )}
      <DisconnectDialog open={leaving} onOpenChange={setLeaving} />
    </div>
  );
}

function CalendarPicker({
  status,
  onDone,
}: {
  status: Extract<GoogleCalendarStatus, { state: "connected" }>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const calendars = useQuery({
    queryKey: ["google-calendar", "list"],
    queryFn: () => listGoogleCalendars(),
  });
  const [read, setRead] = useState<string[]>(status.readCalendarIds);
  const [write, setWrite] = useState<string | null>(status.writeCalendarId);
  const save = useMutation({
    mutationFn: () =>
      saveGoogleCalendarChoice({
        data: { readIds: read, writeId: write && read.includes(write) ? write : null },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: statusKey });
      onDone();
      try {
        const r = await syncGoogleCalendarNow();
        toast[r.ok ? "success" : "message"](r.message);
      } finally {
        void qc.invalidateQueries({ queryKey: statusKey });
        void qc.invalidateQueries({ queryKey: eventKeys.all });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save."),
  });

  if (calendars.isLoading)
    return <p className="text-sm text-muted-foreground">Loading your calendars…</p>;
  if (calendars.isError)
    return (
      <p className="text-sm text-muted-foreground">
        Couldn't load your calendars. Try again later.
      </p>
    );

  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Show in Life OS</legend>
        {(calendars.data ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <Checkbox
              id={`gcal-read-${c.id}`}
              checked={read.includes(c.id)}
              onCheckedChange={(on) =>
                setRead((r) => (on ? [...new Set([...r, c.id])] : r.filter((id) => id !== c.id)))
              }
            />
            <Label htmlFor={`gcal-read-${c.id}`} className="font-normal">
              {c.name}
              {c.canWrite ? "" : " (read only)"}
            </Label>
          </div>
        ))}
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor="gcal-write">New Life OS events go to</Label>
        <select
          id="gcal-write"
          className="h-11 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
          value={write ?? ""}
          onChange={(e) => setWrite(e.target.value || null)}
        >
          <option value="">Nowhere (keep them in Life OS only)</option>
          {(calendars.data ?? [])
            .filter((c) => c.canWrite && read.includes(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => save.mutate()} disabled={!read.length || save.isPending}>
          {status.syncEnabled ? "Save" : "Start syncing"}
        </Button>
        {status.syncEnabled ? (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DisconnectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [removeImported, setRemoveImported] = useState(false);
  const leave = useMutation({
    mutationFn: () => disconnectGoogleCalendar({ data: { removeImported } }),
    onSuccess: () => {
      toast.success("Google Calendar disconnected.");
      void qc.invalidateQueries({ queryKey: statusKey });
      void qc.invalidateQueries({ queryKey: eventKeys.all });
    },
    onError: () => toast.error("Couldn't disconnect. Try again."),
  });
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
          <AlertDialogDescription>
            Life OS stops syncing and gives up its access at Google. Your Google calendar isn't
            changed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2">
          <Checkbox
            id="gcal-remove"
            checked={removeImported}
            onCheckedChange={(v) => setRemoveImported(v === true)}
          />
          <Label htmlFor="gcal-remove" className="font-normal">
            Also remove the events copied from Google (events you made in Life OS stay)
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => leave.mutate()}>Disconnect</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Calendar page: one quiet line, and a sync when the page opens if it's been a while. */
export function GoogleCalendarBar() {
  const status = useGoogleStatus();
  const sync = useSyncNow();
  const started = useRef(false);
  const s = status.data;
  const due =
    s?.state === "connected" &&
    s.syncEnabled &&
    (!s.lastSyncAt || Date.now() - Date.parse(s.lastSyncAt) > AUTO_SYNC_AFTER_MS);

  useEffect(() => {
    if (due && !started.current) {
      started.current = true;
      sync.mutate();
    }
  }, [due, sync]);

  if (!s) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <CalendarSync className="size-3.5" aria-hidden />
      {s.state === "not_configured" ? (
        <span>Google Calendar: not set up yet</span>
      ) : s.state === "disconnected" ? (
        <Link to="/settings" className="underline">
          Connect Google Calendar
        </Link>
      ) : !s.syncEnabled ? (
        <Link to="/settings" className="underline">
          Choose Google calendars to sync
        </Link>
      ) : (
        <>
          <span>{sync.isPending ? "Syncing with Google…" : lastSynced(s.lastSyncAt)}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            Sync now
          </Button>
        </>
      )}
    </div>
  );
}
