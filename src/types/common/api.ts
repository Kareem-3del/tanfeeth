export interface FetchOptions extends RequestInit {
    params?: Record<string, string | number | boolean>;
    useAuth?: boolean;
}

export interface PaginatedResult<T> {
    total: number;
    items: T[];
}

export interface CursorPaginatedResult<T> {
    hasNextPage: boolean;
    data: T[];
}

export interface CursorPaginatedWithTotal<T> extends CursorPaginatedResult<T> {
    total: number;
}

export interface CursorMetaResult<T> {
    items: T[];
    meta: ApiMeta;
}

export interface ApiMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
