"use client"

import { createContext } from "react"

import { AuthState } from "../types/auth-context"

export const AuthStateContext = createContext<AuthState | null>(null)
