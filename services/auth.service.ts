import * as authRepository from "@/repositories/auth.repository";

export const authService = {
  signIn: authRepository.signIn,

  signOut: authRepository.signOut,

  getUser: authRepository.getUser,

  getSession: authRepository.getSession,
};