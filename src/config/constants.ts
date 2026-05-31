export const SUPABASE_BUCKET = "store"

export const PASSWORD_MIN_LENGTH = 6

export const API_RECORDED_LIMIT = 12

export const API_SPECIFICATION_LIMIT = 24

export const INFINITE_RECORDED_LIMIT = 6

export const REQUEST_TIMEOUT = 30000

export const API_ALL_VALUE = "all*"

export const VAT_FEE = 0.14

export const SHIPPING_FEE = 20

export const SUPPORTED_COUNTRIES_ISO = ["eg", "sa", "ae", "us"] as const

export const ACCESS_TOKEN_KEY = "access_token"

export const REFRESH_TOKEN_KEY = "refresh_token"

export const LOCALE_KEY = "NEXT_LOCALE"

export const DEFAULT_TIMEZONE = "Africa/Cairo";

export const COUNTRIES = [
    { label: "countries.eg", value: "EG" },
    { label: "countries.sa", value: "SA" },
    { label: "countries.ae", value: "AE" },
] as const;