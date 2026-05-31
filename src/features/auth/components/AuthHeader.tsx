"use client";

import { Link } from "@/i18n/routing";
import { Button } from "@/shared/components/shadcn/button";
import { cn } from "@/shared/lib/utils";

interface AuthHeaderProps {
    title: string;
    description?: string;
    linkText?: string;
    linkHref?: string;
    className?: string;
}

export const AuthHeader = ({
    title,
    description,
    linkText,
    linkHref,
    className,
}: AuthHeaderProps) => {
    return (
        <div className={cn("flex flex-col gap-2 text-center", className)}>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {title}
            </h1>

            {(description || (linkText && linkHref)) && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {description}{" "}
                    {linkText && linkHref && (
                        <Button
                            variant="link"
                            className="p-0 h-auto font-medium text-blue-600 hover:text-blue-500"
                            asChild
                        >
                            <Link href={linkHref}>{linkText}</Link>
                        </Button>
                    )}
                </p>
            )}
        </div>
    );
};