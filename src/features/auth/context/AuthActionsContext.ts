import { createContext } from "react";

import type { AuthActions } from "./../types/auth-context";

export const AuthActionsContext = createContext<AuthActions | null>(null);