import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  removeWorkMember,
  renewWorkCode,
  saveMember,
  workKeys,
  workMembersQuery,
  workPlacesQuery,
  type MemberPatch,
  type WorkMember,
  type WorkOrg,
} from "@/data/work/api";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";

/** People: the invite code, and each member's role, salary, rate and places. */
export function PeopleAdmin({ org, me }: { org: WorkOrg; me: WorkMember }) {
  const queryClient = useQueryClient();
  const members = useQuery(workMembersQuery(org.id));
  const refresh = () => void queryClient.invalidateQueries({ queryKey: workKeys.all });
  const renew = useMutation({
    mutationFn: () => renewWorkCode(org.id),
    onSuccess: refresh,
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  return (
    <div className="space-y-5">
      <section className="stat-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm font-semibold">{t("Invite code")}</p>
          <p className="text-xs text-muted-foreground">
            {t("People join in Settings → Work → Join with a code.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-secondary px-3 py-1.5 font-mono text-lg tracking-widest">
            {org.invite_code}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("New code")}
            disabled={renew.isPending}
            onClick={() => renew.mutate()}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </section>
      <ul className="space-y-3">
        {(members.data ?? []).map((member) => (
          <MemberRow key={member.user_id} org={org} member={member} me={me} onSaved={refresh} />
        ))}
      </ul>
    </div>
  );
}

function MemberRow({
  org,
  member,
  me,
  onSaved,
}: {
  org: WorkOrg;
  member: WorkMember;
  me: WorkMember;
  onSaved: () => void;
}) {
  const places = useQuery(workPlacesQuery(org.id));
  const [salary, setSalary] = useState(String(member.base_salary ?? 0));
  const [rate, setRate] = useState(
    member.overtime_rate == null ? "" : String(member.overtime_rate),
  );
  const save = useMutation({
    mutationFn: (patch: MemberPatch) => saveMember(org.id, member.user_id, patch),
    onSuccess: () => {
      onSaved();
      toast.success(t("Saved"));
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const remove = useMutation({
    mutationFn: () => removeWorkMember(org.id, member.user_id),
    onSuccess: onSaved,
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const isOwner = member.role === "owner";
  const allowed = member.place_ids ?? [];

  return (
    <li className="stat-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {member.display_name}
          {member.user_id === me.user_id ? (
            <span className="ms-2 text-xs text-muted-foreground">{t("you")}</span>
          ) : null}
        </p>
        {isOwner ? (
          <span className="text-xs text-muted-foreground">{t("Owner")}</span>
        ) : me.role === "owner" ? (
          <select
            className="h-9 rounded-lg border border-border bg-card px-2 text-sm"
            value={member.role}
            onChange={(event) => save.mutate({ role: event.target.value as WorkMember["role"] })}
            aria-label={t("Role")}
          >
            <option value="member">{t("Member")}</option>
            <option value="admin">{t("Admin")}</option>
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t(member.role === "admin" ? "Admin" : "Member")}
          </span>
        )}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const base = Number(salary);
          const ownRate = rate.trim() === "" ? null : Number(rate);
          if (!Number.isFinite(base) || base < 0 || (ownRate !== null && !(ownRate >= 0))) {
            toast.error(t("Enter amounts as numbers."));
            return;
          }
          save.mutate({ base_salary: base, overtime_rate: ownRate });
        }}
      >
        <label className="space-y-1 text-xs text-muted-foreground">
          {t("Base salary")}
          <Input
            inputMode="decimal"
            className="h-9 w-32"
            value={salary}
            onChange={(event) => setSalary(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          {t("Own hourly rate (optional)")}
          <Input
            inputMode="decimal"
            className="h-9 w-32"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={save.isPending}>
          Save
        </Button>
      </form>
      {(places.data ?? []).length > 1 ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {t("Places they can clock in at (none ticked = all)")}
          </p>
          <div className="flex flex-wrap gap-2">
            {(places.data ?? []).map((place) => {
              const on = allowed.includes(place.id);
              return (
                <button
                  key={place.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    save.mutate({
                      place_ids: on
                        ? allowed.filter((id) => id !== place.id)
                        : [...allowed, place.id],
                    })
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {place.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {!isOwner && member.user_id !== me.user_id ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => remove.mutate()}
        >
          {t("Remove from the company")}
        </Button>
      ) : null}
    </li>
  );
}
