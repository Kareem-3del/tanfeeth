export type Role =
    | "guest"
    | "user"
    | "support"
    | "admin"

export interface User {
    id: string;
    profileId: string
    created_at: string
    full_name: string
    role: Role,
    email: string,
    phone?: string | null
    avatar_url?: string | null
}