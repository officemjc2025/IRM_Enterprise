import * as profileRepository from "@/repositories/profile/profile.repository";
import { Profile } from "@/types/profile";

export const profileService = {
  async getProfile(id: string): Promise<Profile | null> {
    const profile = await profileRepository.getProfile(id);

    // No profile found.
    // This can happen for legacy users created before
    // the profile trigger was introduced.
    if (!profile) {
      return null;
    }

    return profile;
  },

  updateProfile: profileRepository.updateProfile,
  createProfile: profileRepository.createProfile,
};