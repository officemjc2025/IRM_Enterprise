"use client";

import { useContext, useState } from "react";
import { AuthContext } from "@/providers/AuthProvider";
import { profileService } from "@/services/profile.service";
import { Profile } from "@/types/profile";

export function useProfile() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useProfile must be used inside AuthProvider");
  }

  const { user, profile, setProfile } = context;
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!user) return null;
    
    setLoading(true);
    try {
      const updatedProfile = await profileService.getProfile(user.id);
      if (updatedProfile && setProfile) {
        setProfile(updatedProfile);
      }
      return updatedProfile;
    } finally {
      setLoading(false);
    }
  };

  const update = async (updates: Partial<Profile>) => {
    if (!user) return null;

    setLoading(true);
    try {
      const updatedProfile = await profileService.updateProfile(user.id, updates);
      if (updatedProfile && setProfile) {
        setProfile(updatedProfile);
      }
      return updatedProfile;
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    loading: context.loading || loading,
    refresh,
    update,
  };
}