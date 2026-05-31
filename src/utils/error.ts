export function errorMapper(error: any): string[] {

    const errorDetails = error.response?.data?.error?.details?.errors || []

    if (errorDetails?.length > 0) {
        return errorDetails
    }
    // Handle API response format: { success: false, error: { code, message } }
    if (error?.response?.data?.error?.message)
        return [error.response.data.error.message];

    if (error?.error?.details?.errors?.length > 0)
        return error?.error?.details?.errors;

    if (error?.error?.message)
        return [error?.error?.message]

    if (error?.response?.data?.message)
        return Array.isArray(error.response.data.message)
            ? error.response.data.message
            : [error.response.data.message];

    if (typeof error === 'string') return [error];

    if (error?.details?.errors) {
        const errs = error.details.errors;
        return Object.keys(errs).map((key: string) => errs[key]);
    }

    if (error?.message) return [error.message];

    if (error?.errors) {
        const errs = error.errors;
        return Object.keys(errs).map((key: string) => errs[key]);
    }

    return ['An unexpected error occurred'];
}