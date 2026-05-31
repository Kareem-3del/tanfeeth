import dayjs from "dayjs";
import { CalendarIcon } from "lucide-react";
import { useFormContext, Controller } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { PopoverTrigger, PopoverContent, Popover } from "@/components/ui/popover";
import { useAppTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

export interface FormDatePickerProps {
    name: string;
    label?: string;
    containerClassName?: string;
    placeholder?: string;
}

export const FormDatePicker: React.FC<FormDatePickerProps> = ({
    name,
    label,
    containerClassName,
    placeholder,
}) => {
    const { control } = useFormContext();
    const t = useAppTranslation("common");

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

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id={name}
                                variant={"outline"}
                                className={cn(
                                    "w-full h-12 justify-start text-left font-normal rounded-xl border px-4 transition-all focus-visible:ring-2",
                                    !field.value && "text-muted-foreground",
                                    error
                                        ? "border-red-500 focus-visible:ring-red-500/20"
                                        : "border-zinc-200 focus-visible:border-blue-500 focus-visible:ring-blue-500/20 dark:border-zinc-800",
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4 text-zinc-500" />
                                {field.value ? (
                                    dayjs(field.value).format("DD/MM/YYYY")
                                ) : (
                                    <span>{placeholder || t("placeholders.choseDate")}</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-xl shadow-xl" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value ? dayjs(field.value).toDate() : undefined}
                                onSelect={(date) => {
                                    field.onChange(date ? dayjs(date).format("YYYY-MM-DD") : null);
                                }}
                                className="rounded-xl border-none"
                            />
                        </PopoverContent>
                    </Popover>

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