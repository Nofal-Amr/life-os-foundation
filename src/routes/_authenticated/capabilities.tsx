import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { EntityIcon, EntityIdentityPicker } from "@/components/app/EntityIdentity";
import { FormDialog } from "@/components/app/FormDialog";
import { PageHeader } from "@/components/app/PageHeader";
import { SemanticBadge } from "@/components/app/SemanticBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  capabilitiesQuery,
  capabilityKeys,
  createCapability,
  deleteCapability,
  updateCapability,
  type Capability,
  type CapabilityInput,
} from "@/data/capabilities";
import { evidenceQuery } from "@/data/evidence";
import { tasksQuery } from "@/data/tasks";
import { usePreferences } from "@/hooks/usePreferences";

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

const emptyForm: CapabilityInput = { name: "", description: null, icon: null, color: null };

function CapabilitiesPage() {
  const queryClient = useQueryClient();
  const capabilities = useQuery(capabilitiesQuery());
  const evidence = useQuery(evidenceQuery());
  const tasks = useQuery(tasksQuery());
  const { fmtDateTime } = usePreferences();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Capability | null>(null);
  const [form, setForm] = useState<CapabilityInput>(emptyForm);
  const [toDelete, setToDelete] = useState<Capability | null>(null);
  const [viewing, setViewing] = useState<Capability | null>(null);

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong.");
  const invalidate = () => queryClient.invalidateQueries({ queryKey: capabilityKeys.all });

  const save = useMutation({
    mutationFn: async () =>
      editing ? updateCapability(editing.id, form) : createCapability(form),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success(editing ? "Capability updated." : "Capability added.");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCapability(id),
    onSuccess: () => {
      invalidate();
      setToDelete(null);
      toast.success("Capability deleted.");
    },
    onError,
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(capability: Capability) {
    setEditing(capability);
    setForm({ name: capability.name, description: capability.description, icon: capability.icon, color: capability.color });
    setDialogOpen(true);
  }

  const evidenceFor = (id: string) =>
    (evidence.data ?? []).filter((item) => item.capability_id === id);
  const taskCountFor = (id: string) =>
    (tasks.data ?? []).filter((task) => task.capability_id === id).length;

  const deleteEvidenceCount = toDelete ? evidenceFor(toDelete.id).length : 0;
  const deleteTaskCount = toDelete ? taskCountFor(toDelete.id) : 0;
  const viewingEvidence = viewing ? evidenceFor(viewing.id) : [];
  const taskTitle = (id: string | null) =>
    (tasks.data ?? []).find((task) => task.id === id)?.title ?? null;

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
          description="A capability is something you are getting better at. Finished work becomes its evidence over time."
          action={<Button onClick={openCreate}>Add capability</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {(capabilities.data ?? []).map((capability) => {
            const count = evidenceFor(capability.id).length;
            return (
              <li key={capability.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                   <div className="flex min-w-0 gap-3">
                     <EntityIcon icon={capability.icon} color={capability.color} />
                     <div className="min-w-0">
                     <p className="truncate font-medium">{capability.name}</p>
                    {capability.description ? (
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {capability.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <SemanticBadge tone={count > 0 ? "positive" : "quiet"}>
                        {count} evidence {count === 1 ? "event" : "events"}
                      </SemanticBadge>
                      {count > 0 ? (
                        <Button size="sm" variant="ghost" onClick={() => setViewing(capability)}>
                          View evidence
                        </Button>
                      ) : null}
                    </div>
                     </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(capability)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(capability)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}


      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit capability" : "New capability"}
        pending={save.isPending}
        onSubmit={() => save.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="capability-name">Name</Label>
          <Input
            id="capability-name"
            required
            className="h-12"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <EntityIdentityPicker value={{ icon: form.icon, color: form.color }} onChange={(identity) => setForm({ ...form, ...identity })} />
        <div className="space-y-2">
          <Label htmlFor="capability-description">Description (optional)</Label>
          <Textarea
            id="capability-description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          />
        </div>
      </FormDialog>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Evidence for {viewing?.name}</DialogTitle>
            <DialogDescription>
              Every completed task linked to this capability, newest first.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border">
            {viewingEvidence.map((item) => (
              <li key={item.id} className="py-3">
                <p className="text-sm font-medium text-foreground">
                  {taskTitle(item.task_id) ?? "Logged evidence"}
                </p>
                {item.note ? (
                  <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(item.created_at)}</p>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this capability?"
        description={
          deleteEvidenceCount > 0 || deleteTaskCount > 0
            ? `This capability has ${deleteEvidenceCount} evidence ${
                deleteEvidenceCount === 1 ? "event" : "events"
              } and ${deleteTaskCount} linked ${deleteTaskCount === 1 ? "task" : "tasks"}. Those records stay, but they will no longer be linked to a capability.`
            : "This cannot be undone."
        }
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}
