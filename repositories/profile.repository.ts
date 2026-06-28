import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/profile";

export async function getProfile(id: string): Promise<Profile | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return data as Profile;
}

export async function updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile:", error);
    return null;
  }

  return data as Profile;
}

export async function createProfile(profile: Omit<Profile, "created_at" | "updated_at">): Promise<Profile | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .insert([profile])
    .select()
    .single();

  if (error) {
    console.error("Error creating profile:", error);
    return null;
  }

  return data as Profile;
}