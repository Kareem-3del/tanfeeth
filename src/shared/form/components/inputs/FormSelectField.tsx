

import { useFormContext, Controller } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

export interface FormSelectFieldProps {
    name: string;
    label?: string;
    options: { label: string; value: string | number }[];
    containerClassName?: string;
    placeholder?: string;
    className?: string;
}

export const FormSelectField: React.FC<FormSelectFieldProps> = ({
    name,
    label,
    options,
    className,
    containerClassName,
    placeholder,
}) => {
    const { control } = useFormContext();
    const t = useAppTranslation("common")
    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error } }) => (
                <div className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
                    {label && (
                        <Label htmlFor={name} className="ml-1 text-zinc-700 dark:text-zinc-300 mb-1">
                            {label}
                        </Label>
                    )}

                    <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                    >
                        <SelectTrigger
                            id={name}
                            className={cn(
                                "h-12 rounded-xl transition-all focus:ring-2",
                                error
                                    ? "border-red-500 focus:ring-red-500/20"
                                    : "border-zinc-200 dark:border-zinc-800 focus:ring-blue-500/20",
                                className
                            )}
                        >
                            <SelectValue placeholder={placeholder || t("placeholders.selectFromMenu")} />
                        </SelectTrigger>

                        <SelectContent className="rounded-xl border-zinc-200 dark:border-zinc-800">
                            {options.map((opt) => (
                                <SelectItem
                                    key={opt.value}
                                    value={opt.value.toString()}
                                    className="cursor-pointer"
                                >
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

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