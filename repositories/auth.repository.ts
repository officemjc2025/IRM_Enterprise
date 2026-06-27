import { createClient } from "@/lib/supabase/client";
import { AuthChangeEvent, Session } from "@supabase/supabase-js";

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

export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  const supabase = createClient();
  
  return supabase.auth.onAuthStateChange(callback);
}