import { authApiProvider } from "../constants/api";
import type { User } from "../types/user";

export const getUserProfile = () => authApiProvider.getCurrentUser()
export const getCurrentUser = () => authApiProvider.getCurrentUser()
export const updateUserProfile = (id: string, payload: Partial<User>) => authApiProvider.updateUserProfile(id, payload)
