export const apiEndPoints = {

    auth: {
        login: "/v1/auth/login",
        signup: "/v1/auth/signup",
        refreshToken: "/v1/auth/refresh-token",
        logout: "/v1/auth/logout",
    },

    media: {
        upload: "/v1/storage/upload",
        delete: (id: string) => `/v1/storage/${id}`,
        getBuyId: (id: string) => `/v1/storage/${id}`
    }

} as const