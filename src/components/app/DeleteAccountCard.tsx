import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount } from "@/data/profile";
import { supabase } from "@/integrations/supabase/client";
import { clearOfflineData } from "@/lib/offline";

const CONFIRM_WORD = "DELETE";

/** Removes everything this app keeps on the device for the account. */
function forgetThisDevice() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("life-os") || key.startsWith("sb-")) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable: nothing was kept there.
  }
}

/**
 * Deleting the account, with what it removes spelled out and a typed
 * confirmation, because it can't be undone.
 */
export function DeleteAccountCard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const remove = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await clearOfflineData();
      // The login no longer exists, so only this device's session is cleared.
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      forgetThisDevice();
      toast.success("Your account and all its data were deleted.");
      navigate({ to: "/", replace: true });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "The account couldn't be deleted."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Removes your login and everything you have logged: tasks, money, health, food, notes,
          habits, prayers, resources and your profile picture. This can't be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            setTyped("");
            setOpen(true);
          }}
        >
          Delete my account…
        </Button>
      </CardContent>

      <AlertDialog open={open} onOpenChange={(next) => !remove.isPending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account for good?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything is deleted from the server and this device straight away. There is no
              backup to restore from. Changes still waiting to sync are lost too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (typed === CONFIRM_WORD) remove.mutate();
            }}
          >
            <Label htmlFor="delete-confirm">
              Type <span className="font-semibold">{CONFIRM_WORD}</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              autoComplete="off"
              autoCapitalize="characters"
              className="h-12"
              value={typed}
              onChange={(event) => setTyped(event.target.value.trim().toUpperCase())}
            />
            <AlertDialogFooter className="pt-3">
              <AlertDialogCancel type="button" disabled={remove.isPending}>
                Keep my account
              </AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                disabled={typed !== CONFIRM_WORD || remove.isPending}
              >
                {remove.isPending ? "Deleting…" : "Delete everything"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
