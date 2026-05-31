import { supabaseAuthProvider } from "../infrastructure/supabaseAuthProvider";
import { AuthApiProvider } from "../types/api-provider";

export const authApiProvider: AuthApiProvider = supabaseAuthProvider
