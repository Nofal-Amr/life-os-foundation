import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Briefcase } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidCode, normaliseCode } from "@/data/together";
import { createWorkOrg, joinWorkOrg, workKeys, workOrgsQuery } from "@/data/work/api";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";

/** Settings → Work: make a company (you're its owner) or join one with a code. */
export function WorkSettingsCard() {
  const queryClient = useQueryClient();
  const orgs = useQuery(workOrgsQuery());
  const [mode, setMode] = useState<"make" | "join" | null>(null);
  const [name, setName] = useState("");
  const [myName, setMyName] = useState("");
  const [code, setCode] = useState("");

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: workKeys.all });
    setMode(null);
    setName("");
    setCode("");
  };
  const make = useMutation({
    mutationFn: () => createWorkOrg(name.trim(), myName.trim()),
    onSuccess: () => {
      done();
      toast.success(t("Company made. Add its places on the Work page."));
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const join = useMutation({
    mutationFn: () => joinWorkOrg(code, myName.trim()),
    onSuccess: () => {
      done();
      toast.success(t("You've joined."));
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  const list = orgs.data ?? [];
  return (
    <section className="stat-card space-y-4 p-5">
      <div>
        <p className="flex items-center gap-2 text-base font-semibold">
          <Briefcase className="size-4" /> {t("Work")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "Clock in and out with your fingerprint at your workplace, and get the month's attendance and pay sheet. A company sees only what's in the company, never your own Life OS.",
          )}
        </p>
      </div>

      {list.length ? (
        <ul className="space-y-1 text-sm">
          {list.map((org) => (
            <li key={org.id} className="flex items-center justify-between gap-3">
              <span>{org.name}</span>
              <Button type="button" size="sm" variant="outline" asChild>
                <Link to="/work">{t("Open")}</Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {mode === null ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setMode("make")}>
            {list.length ? t("Make another company") : t("Make a test company")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMode("join")}>
            Join with a code
          </Button>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === "make" && name.trim() && myName.trim()) make.mutate();
            if (mode === "join" && isValidCode(code) && myName.trim()) join.mutate();
          }}
        >
          {mode === "make" ? (
            <div className="space-y-1.5">
              <Label htmlFor="work-org-name">Company name</Label>
              <Input
                id="work-org-name"
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="work-code">Invite code</Label>
              <Input
                id="work-code"
                value={code}
                inputMode="text"
                autoCapitalize="characters"
                className="font-mono tracking-widest"
                onChange={(event) => setCode(normaliseCode(event.target.value))}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="work-my-name">Your name there</Label>
            <Input
              id="work-my-name"
              value={myName}
              maxLength={40}
              onChange={(event) => setMyName(event.target.value)}
            />
          </div>
          {mode === "make" ? (
            <p className="text-xs text-muted-foreground">
              {t(
                "It starts with an example set of rules (your office's sheet) that you can change.",
              )}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={make.isPending || join.isPending}>
              {mode === "make" ? t("Make it") : t("Join")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
