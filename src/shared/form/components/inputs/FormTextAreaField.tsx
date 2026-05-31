import React from "react";
import { useFormContext, Controller } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";


export interface FormTextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    name: string;
    label?: string;
    containerClassName?: string;
}

export const FormTextAreaField: React.FC<FormTextAreaFieldProps> = ({
    name,
    label,
    className,
    containerClassName,
    rows = 4,
    ...props
}) => {
    const { control } = useFormContext();

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error } }) => (
                <div className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
                    {label && (
                        <Label
                            htmlFor={name}
                            className="ml-1 text-(--text-muted) dark:text-zinc-300 mb-2 font-bold leading-none text-[clamp(1.125rem,1.25vw,1.25rem)]"

                        >
                            {label}
                        </Label>
                    )}

                    <Textarea
                        {...field}
                        {...props}
                        id={name}
                        rows={rows}
                        value={field.value ?? ""}
                        className={cn(
                            "min-h-25 rounded-xl transition-all focus-visible:ring-2 resize-y",
                            error
                                ? "border-red-500 focus-visible:ring-red-500/20"
                                : "focus-visible:border-blue-500 focus-visible:ring-blue-500/20",
                            className
                        )}
                    />

                    {error && (
                        <p className="text-xs font-medium text-red-500 ml-1 animate-in fade-in slide-in-from-top-1">
                            {error.message}
                        </p>
                    )}
                </div>
            )}
        />
    );
};