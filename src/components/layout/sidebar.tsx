"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DashboardNavigation } from "@/config/dashboard-navigation-config";
import { Link, usePathname } from "@/lib/i18n/routing";
import { useAppTranslation } from "@/lib/i18n/use-translation";

export function Sidebar() {
    const t = useAppTranslation("common");
    const pathname = usePathname();
    const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

    const user = {
        name: "خالد العتيبي",
        email: "khalid@tanfeeth.sa",
        avatar: "https://github.com/shadcn.png"
    };

    const toggleOpen = (title: string) => {
        setOpenItems(prev => ({ ...prev, [title]: !prev[title] }));
    };

    return (
        <aside className="w-70 h-screen bg-(--sidebar-bg) p-6 border-l border-sidebar-border flex flex-col">

            {/* User Profile Section - الآن في الأعلى */}
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-sidebar-border">
                <Avatar className="h-12 w-12 border border-gray-200">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-(--primary-light) text-(--primary-color)">
                        {user.name.charAt(0)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-[14px] font-bold text-(--text-main) truncate">{user.name}</span>
                    <span className="text-[12px] text-(--text-muted) truncate">{user.email}</span>
                </div>
            </div>

            {/* Navigation Section */}
            <nav className="flex flex-col gap-6 flex-1 overflow-y-auto">
                {DashboardNavigation.map((section) => (
                    <div key={section.id}>
                        <h4 className="text-[12px] font-bold text-(--text-muted) uppercase mb-4 px-2">
                            {t(section.subheader as any)}
                        </h4>

                        <div className="flex flex-col gap-2">
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const isChildActive = item.children?.some(child => pathname === child.path);
                                const isActive = pathname === item.path || isChildActive;
                                const hasChildren = item.children && item.children.length > 0;

                                return (
                                    <div key={item.title}>
                                        <button
                                            onClick={() => hasChildren ? toggleOpen(item.title) : null}
                                            className={`cursor-pointer flex w-full items-center justify-between p-3 rounded-xl transition-all ${isActive ? "bg-(--primary-light) text-(--primary-color)" : "text-(--text-main) hover:bg-gray-50"}`}
                                        >
                                            <Link href={item.path || "#"} className="flex items-center gap-3">
                                                {Icon && <Icon size={20} />}
                                                <span className="text-[14px] font-medium">{t(item.title as any)}</span>
                                            </Link>
                                            {hasChildren && <ChevronDown size={16} className={`transition-transform ${openItems[item.title] ? "rotate-180" : ""}`} />}
                                        </button>

                                        {hasChildren && openItems[item.title] && (
                                            <div className="mt-2 mr-8 flex flex-col gap-1 border-r-2 border-gray-100 pr-4">
                                                {item.children?.map((child) => (
                                                    <Link
                                                        key={child.title}
                                                        href={child.path || "#"}
                                                        className={`flex items-center gap-3 p-2 rounded-lg text-[13px] ${pathname === child.path ? "text-(--primary-color) font-bold" : "text-(--text-muted) hover:text-(--text-main)"}`}
                                                    >
                                                        {child.icon && <child.icon size={16} />}
                                                        {t(child.title as any)}
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    );
}