export interface NavItem {
    title: string;
    path?: string;
    icon?: any;
    permissions?: string;
    children?: NavItem[];
}

export interface NavSection {
    subheader: string;
    id: string;
    requireLab?: boolean;
    items: NavItem[];
}