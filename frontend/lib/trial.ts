import { getSupabaseAdmin } from "./supabaseAdmin";

export type TrialRequestRow = {
  id: string;
  email: string;
  name: string;
  status: "pending" | "sent" | "expired";
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  session_id: string | null;
};

export type TrialCheck =
  | { valid: true; row: TrialRequestRow }
  | { valid: false; reason: "invalid" | "used" | "expired" };

// Server-side validation shared by every trial route. Performs the lazy
// expiry check so an expired link is never honored, regardless of pg_cron.
export async function checkTrialToken(token: string | null): Promise<TrialCheck> {
  if (!token) return { valid: false, reason: "invalid" };

  const { data, error } = await getSupabaseAdmin()
    .from("trial_requests")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return { valid: false, reason: "invalid" };

  const row = data as TrialRequestRow;
  if (row.used_at) return { valid: false, reason: "used" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, row };
}
