import * as authRepository from "@/repositories/auth/auth.repository";

export const authService = {
  signIn: authRepository.signIn,
  signOut: authRepository.signOut,
  getUser: authRepository.getUser,
  getSession: authRepository.getSession,
  onAuthStateChange: authRepository.onAuthStateChange,
  refreshSession: authRepository.refreshSession,
};