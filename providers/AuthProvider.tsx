"use client";

import { ReactNode, createContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { authService } from "@/services/auth.service";
import { profileService } from "@/services/profile.service";
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
    const initializeAuth = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await authService.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const userProfile = await profileService.getProfile(session.user.id);
          setProfile(userProfile);
        }
      } catch (error) {
        console.error("Failed to load session:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = authService.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        const userProfile = await profileService.getProfile(currentSession.user.id);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, profile, setProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}