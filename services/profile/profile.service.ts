import * as profileRepository from "@/repositories/profile/profile.repository";

export const profileService = {
  getProfile: profileRepository.getProfile,
  updateProfile: profileRepository.updateProfile,
  createProfile: profileRepository.createProfile,
};
