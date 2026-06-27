import { createClient } from "@/lib/supabase/client";

export async function signIn(
  email: string,
  password: string
) {
  const supabase = createClient();

  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signOut() {
  const supabase = createClient();

  return supabase.auth.signOut();
}

export async function getUser() {
  const supabase = createClient();

  return supabase.auth.getUser();
}

export async function getSession() {
  const supabase = createClient();

  return supabase.auth.getSession();
}