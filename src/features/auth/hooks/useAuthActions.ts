import { useContext } from "react"

import { AuthActionsContext } from "../context/AuthActionsContext"

export const useAuthActions = () => {
    const context = useContext(AuthActionsContext)
    if (!context) throw new Error("useAuthActions must be used inside AuthProvider")
    return context
}
