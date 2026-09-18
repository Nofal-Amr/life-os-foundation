import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  capabilitiesQuery,
  capabilityKeys,
  createCapability,
  type CapabilityInput,
} from "@/data/capabilities";
import { evidenceQuery } from "@/data/evidence";

export const Route = createFileRoute("/_authenticated/capabilities")({
  head: () => ({
    meta: [
      { title: "Capabilities — Life OS" },
      {
        name: "description",
        content: "Track the capabilities you are building and the evidence behind them.",
      },
      { property: "og:title", content: "Capabilities — Life OS" },
      {
        property: "og:description",
        content: "Track the capabilities you are building and the evidence behind them.",
      },
    ],
  }),
  component: CapabilitiesPage,
});

const emptyForm: CapabilityInput = { name: "", description: null };

function CapabilitiesPage() {
  const queryClient = useQueryClient();
  const capabilities = useQuery(capabilitiesQuery());
  const evidence = useQuery(evidenceQuery());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CapabilityInput>(emptyForm);

  const save = useMutation({
    mutationFn: async () => createCapability(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: capabilityKeys.all });
      setDialogOpen(false);
      toast.success("Capability added.");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Something went wrong."),
  });

  function openCreate() {
    setForm(emptyForm);
    setDialogOpen(true);
  }

  const countFor = (id: string) =>
    (evidence.data ?? []).filter((e) => e.capability_id === id).length;

  return (
    <>
      <PageHeader
        title="Capabilities"
        description="What you are building, backed by evidence."
        actions={<Button onClick={openCreate}>Add capability</Button>}
      />

      {capabilities.isLoading ? (
        <LoadingState />
      ) : capabilities.error ? (
        <ErrorState error={capabilities.error} onRetry={() => capabilities.refetch()} />
      ) : (capabilities.data ?? []).length === 0 ? (
        <EmptyState
          title="No capabilities yet"
          description="Name a capability you want to build, then let completed work become its evidence."
          action={<Button onClick={openCreate}>Add capability</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {(capabilities.data ?? []).map((c) => {
            const count = countFor(c.id);
            return (
              <li key={c.id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-medium">
                  {c.name}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    — {count} evidence {count === 1 ? "event" : "events"}
                  </span>
                </p>
                {c.description ? (
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{c.description}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="New capability"
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="capability-name">Name</Label>
          <Input
            id="capability-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capability-description">Description</Label>
          <Textarea
            id="capability-description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          />
        </div>
      </FormDialog>
    </>
  );
}
