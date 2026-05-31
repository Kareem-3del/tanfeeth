import { SignupApiRequest } from './request';
import type { User } from "./user";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean
}

export type AuthAction =
  | { type: "RESTORE_SESSION"; payload: User }
  | { type: "LOGIN"; payload: User }
  | { type: "SIGNUP"; payload: User }
  | { type: "LOGOUT" }
  | { type: "UPDATE_USER"; payload: Partial<User> }
  | { type: "SET_LOADING"; payload: boolean }

export interface AuthActions {
  login: (email: string, password: string, remapUser?: (user: User) => User) => Promise<void>;
  signup: (data: SignupApiRequest, remapUser?: (user: User) => User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (id: string, data: Partial<User>) => Promise<void>;
}
