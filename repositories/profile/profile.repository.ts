import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/profile";
import { SupabaseClient } from "@supabase/supabase-js";

export async function getProfile(id: string, supabaseClient?: SupabaseClient): Promise<Profile | null> {
  const supabase = supabaseClient || createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Profile does not exist. Return null without error logging.
      return null;
    }

    console.error("[ProfileRepository] Failed to fetch profile", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  return data as Profile;
}

export async function updateProfile(id: string, updates: Partial<Profile>, supabaseClient?: SupabaseClient): Promise<Profile | null> {
  const supabase = supabaseClient || createClient();

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  return data as Profile;
}

export async function createProfile(profile: Omit<Profile, "created_at" | "updated_at">, supabaseClient?: SupabaseClient): Promise<Profile | null> {
  const supabase = supabaseClient || createClient();

  const { data, error } = await supabase
    .from("profiles")
    .insert([profile])
    .select()
    .single();

  if (error) {
    console.error("Error creating profile:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  return data as Profile;
}
