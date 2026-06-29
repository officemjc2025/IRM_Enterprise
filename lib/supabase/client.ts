import { createBrowserClient } from "@supabase/ssr";



export const createClient = () => {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  if (typeof window !== "undefined") {
    const originalOnAuthStateChange = client.auth.onAuthStateChange.bind(client.auth);
    client.auth.onAuthStateChange = (callback) => {
      return originalOnAuthStateChange((event, session) => {
        setTimeout(() => {
          callback(event, session);
        }, 0);
      });
    };
  }

  return client;
};