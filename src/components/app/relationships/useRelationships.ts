import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  interactionsQuery,
  isMissingTable,
  linksQuery,
  peopleQuery,
  relationshipKeys,
  rulesQuery,
} from "@/data/relationshipsApi";

/** Everything Relationships needs, plus whether the database has the tables yet. */
export function useRelationships(enabled = true) {
  const queryClient = useQueryClient();
  const people = useQuery({ ...peopleQuery(), enabled });
  // The rest wait until we know the tables exist.
  const ready = enabled && people.isSuccess;
  const links = useQuery({ ...linksQuery(), enabled: ready });
  const interactions = useQuery({ ...interactionsQuery(), enabled: ready });
  const rules = useQuery({ ...rulesQuery(), enabled: ready });

  const error = people.error ?? links.error ?? interactions.error ?? rules.error;
  return {
    people: people.data ?? [],
    links: links.data ?? [],
    interactions: interactions.data ?? [],
    rules: rules.data ?? [],
    isLoading:
      people.isLoading || (ready && (links.isLoading || interactions.isLoading || rules.isLoading)),
    needsSetup: isMissingTable(error),
    error: isMissingTable(error) ? null : error,
    retry: () => void queryClient.invalidateQueries({ queryKey: relationshipKeys.all }),
    refresh: () => queryClient.invalidateQueries({ queryKey: relationshipKeys.all }),
  };
}
