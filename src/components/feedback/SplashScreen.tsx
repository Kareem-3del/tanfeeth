"use client";

import { Logo } from "@/shared/layouts/common/Logo";
import { cn } from "@/shared/lib/utils";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
    withLogo?: boolean;
}

export function SplashScreen({ withLogo, className, ...props }: Props) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center w-full min-h-screen bg-background space-y-6",
                className
            )}
            {...props}
        >
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes mui-smooth-progress {
                    0% { 
                        left: -45%; 
                        width: 40%; 
                    }
                    100% { 
                        left: 100%; 
                        width: 50%; 
                    }
                }
            `}} />

            {withLogo && (
                <div className="animate-in fade-in zoom-in duration-700">
                    <Logo className="pointer-events-none w-32 h-auto" />
                </div>
            )}

            <div className="w-1/2 max-w-[500px] h-1 bg-primary/10 rounded-full overflow-hidden relative shadow-sm">
                <div
                    className="absolute h-full bg-primary"
                    style={{

                        animation: "mui-smooth-progress 1.2s linear infinite",
                        position: "absolute",
                        willChange: "left, width",
                        borderRadius: "inherit"
                    }}
                />
            </div>

            <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-primary/60 animate-pulse">
                Loading
            </p>
        </div>
    );
}