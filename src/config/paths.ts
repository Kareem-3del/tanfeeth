export const paths = {
    home: "/",
    contact: "/contact-us",
    about: "/about-us",
    auth: {
        login: "/auth/login"
    },

    dashboard: {
        index: "/dashboard",
        projects: {
            index: "/dashboard/projects",
            add: "/dashboard/projects/new",
            edit: (id: string) => `/dashboard/projects/edit/${id}`
        },
        contracts: {
            index: "/dashboard/contracts",
            add: "/dashboard/contracts/new",
            edit: (id: string) => `/dashboard/contracts/edit/${id}`
        }
    }

}