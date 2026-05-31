import { Controller, useFormContext } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormCheckboxProps {
    name: string;
    label: string;
    containerClassName?: string;
}

export function FormCheckbox({
    name,
    label,
    containerClassName,
}: FormCheckboxProps) {
    const { control } = useFormContext();

    return (
        <Controller
            name={name}
            control={control}
            defaultValue={false}
            render={({ field, fieldState: { error } }) => (
                <div className={cn("flex flex-col gap-2", containerClassName)}>
                    <div className="flex items-center space-x-2 space-x-reverse gap-1.5">
                        <Checkbox
                            id={name}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className={cn(
                                "h-5 w-5 rounded-md transition-all",
                                error
                                    ? "border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                                    : "border-zinc-300 dark:border-zinc-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            )}
                        />
                        <Label
                            htmlFor={name}
                            className="ml-1 text-(--text-muted) dark:text-zinc-300 mb-1 font-bold leading-none text-[clamp(1.125rem,1.25vw,1.25rem)]"
                        >
                            {label}
                        </Label>
                    </div>

                    {error && (
                        <p className="text-xs font-medium text-red-500 ml-1 animate-in fade-in slide-in-from-top-1">
                            {error.message}
                        </p>
                    )}
                </div>
            )}
        />
    );
}