import * as profileRepository from "@/repositories/profile.repository";

export const profileService = {
  getProfile: profileRepository.getProfile,
  updateProfile: profileRepository.updateProfile,
  createProfile: profileRepository.createProfile,
};