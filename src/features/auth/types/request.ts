export interface LoginApiRequest {
    email: string;
    password: string
}

export interface SignupApiRequest {
    email: string;
    password: string
    full_name: string
    phone?: string
}

