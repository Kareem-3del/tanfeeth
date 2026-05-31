// useAuthState.ts
import { useContext } from "react"

import { AuthStateContext } from "../context/AuthStateContext"

export const useAuthState = () => {
    const context = useContext(AuthStateContext)
    if (!context) throw new Error("useAuthState must be used inside AuthProvider")
    return context
}
