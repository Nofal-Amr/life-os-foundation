import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ALL_MODULE_KEYS, enabledModules, type ModuleKey } from "@/data/modules";
import { preferencesKeys, preferencesQuery, savePreferences } from "@/data/preferences";

/** The modules this user chose to see. Defaults to everything. */
export function useModules() {
  const query = useQuery(preferencesQuery());
  const queryClient = useQueryClient();
  const enabled = enabledModules(query.data?.enabled_modules);

  const save = useMutation({
    mutationFn: (next: string[]) => savePreferences({ enabled_modules: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: preferencesKeys.current }),
  });

  return {
    enabled,
    isLoading: query.isLoading,
    isEnabled: (key: ModuleKey) => enabled.includes(key),
    setModules: (next: string[]) => save.mutate(next.length ? next : ALL_MODULE_KEYS),
    toggleModule: (key: ModuleKey, on: boolean) =>
      save.mutate(on ? [...new Set([...enabled, key])] : enabled.filter((item) => item !== key)),
    isSaving: save.isPending,
  };
}
