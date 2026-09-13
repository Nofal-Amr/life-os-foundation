import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { unwrap } from "@/lib/supabase-helpers";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const profileKeys = { current: ["profile"] as const };

export const profileQuery = () =>
  queryOptions({
    queryKey: profileKeys.current,
    queryFn: async () =>
      unwrap(await supabase.from("profiles").select("*").maybeSingle()) as Profile | null,
  });
