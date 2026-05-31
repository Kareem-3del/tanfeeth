export const getAllErrorMessages = (errors: any): string[] => {
    const messages: string[] = [];

    const traverse = (err: any) => {
        if (!err || typeof err !== 'object') return;

        if (err.message && typeof err.message === 'string') {
            messages.push(err.message);
            return;
        }

        Object.values(err).forEach(traverse);
    };

    traverse(errors);
    return Array.from(new Set(messages));
};

export const getFirstErrorPath = (errors: any, parentPath = ''): string | null => {
    if (!errors) return null;

    for (const key of Object.keys(errors)) {
        const value = errors[key];
        const currentPath = parentPath ? `${parentPath}.${key}` : key;

        if (value && typeof value === 'object' && 'message' in value && value.message) {
            return currentPath;
        }

        if (value && typeof value === 'object' && key !== 'ref' && key !== 'type') {
            const nestedPath = getFirstErrorPath(value, currentPath);
            if (nestedPath) return nestedPath;
        }
    }

    return null;
};