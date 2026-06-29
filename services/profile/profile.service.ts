import * as profileRepository from "@/repositories/profile/profile.repository";
import { Profile } from "@/types/profile";

export const profileService = {
  async getProfile(id: string): Promise<Profile | null> {
    const profile = await profileRepository.getProfile(id);
    if (!profile) {
      console.error(`DataIntegrityError: Profile record not found for user ID: ${id}. The database trigger handle_new_user should automatically create user profiles upon auth registration.`);
      return null;
    }
    return profile;
  },

  updateProfile: profileRepository.updateProfile,
  createProfile: profileRepository.createProfile,
};
