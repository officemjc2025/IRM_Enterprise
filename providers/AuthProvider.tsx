"use client";

import { ReactNode, createContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { authService } from "@/services/auth/auth.service";
import { profileService } from "@/services/profile/profile.service";
import { Profile } from "@/types/profile";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export default function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    let isInitialized = false;

    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await authService.getSession();
        if (!isMounted || isInitialized) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          const userProfile = await profileService.getProfile(currentSession.user.id);
          if (isMounted) {
            setProfile(userProfile);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Failed to load session:", error);
      } finally {
        if (isMounted && !isInitialized) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = authService.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return;

      isInitialized = true;

      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        try {
          const userProfile = await profileService.getProfile(currentSession.user.id);
          if (isMounted) {
            setProfile(userProfile);
          }
        } catch (error) {
          console.error("Failed to load user profile on auth change:", error);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, profile, setProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}