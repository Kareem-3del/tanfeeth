import { ReactNode, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface FormSectionProps {
    title?: string;
    children: ReactNode;
    gridCols?: 1 | 2 | 3;
    stepNumber?: number;
    isActive?: boolean;
    isLast?: boolean; // لإخفاء الخط في آخر خطوة
    onVisible?: () => void;
}

export function FormSection({ title, children, gridCols = 3, stepNumber, isActive, isLast = false, onVisible }: FormSectionProps) {
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && onVisible) onVisible();
            },
            { threshold: 0.5 }
        );

        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, [onVisible]);

    return (
        <section ref={sectionRef} className="relative flex gap-6">
            {/* الجزء الجانبي (الدائرة والخط) */}
            <div className="flex flex-col items-center">
                <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 z-10 transition-all duration-300",
                    isActive
                        ? "bg-teal-700 border-teal-700 text-white"
                        : "bg-white border-zinc-200 text-zinc-400"
                )}>
                    {stepNumber}
                </div>

                {/* الخط الرابط */}
                {!isLast && (
                    <div className={cn(
                        "w-0.5 flex-1  transition-colors duration-300",
                        isActive ? "bg-teal-700" : "bg-zinc-200"
                    )} />
                )}
            </div>

            {/* المحتوى */}
            <div className={cn(
                "flex-1 p-6 bg-white dark:bg-zinc-950 border rounded-3xl transition-all duration-300 mb-8",
                isActive ? "border-teal-600 shadow-md" : "border-zinc-100 dark:border-zinc-800"
            )}>
                {title && (
                    <h3 className="text-[clamp(1.125rem,1.25vw,1.25rem)] font-bold text-primary mb-6 pb-4 border-b border-zinc-100">
                        {title}
                    </h3>
                )}
                <div className={cn("grid gap-6", {
                    "grid-cols-1": gridCols === 1,
                    "grid-cols-1 md:grid-cols-2": gridCols === 2,
                    "grid-cols-1 md:grid-cols-3": gridCols === 3,
                })}>
                    {children}
                </div>
            </div>
        </section>
    );
}