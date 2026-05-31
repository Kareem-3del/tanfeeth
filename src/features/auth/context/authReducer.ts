
import type { AuthState, AuthAction } from "../types/auth-context"

export const authReducer = (state: AuthState, action: AuthAction): AuthState => {
    switch (action.type) {
        case "RESTORE_SESSION":
            return { ...state, user: action.payload, isAuthenticated: true, isLoading: false }
        case "LOGIN":
            return { ...state, user: action.payload, isAuthenticated: true, isLoading: false }
        case "LOGOUT":
            return { ...state, user: null, isAuthenticated: false, isLoading: false }
        case "UPDATE_USER":
            if (!state.user) return state
            return { ...state, user: { ...state.user, ...action.payload } }
        case "SET_LOADING":
            return { ...state, isLoading: action.payload }
        default: return state
    }
}
