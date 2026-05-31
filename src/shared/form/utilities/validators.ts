import { z } from "zod";

import { PasswordValidatorOptions } from "../types/validation";

export const emailValidator = ({
    invalidEmailMsg = "Invalid email",
    requireMsg = "Email is required"
}: {
    invalidEmailMsg?: string,
    requireMsg?: string
}) => z
    .email({ message: invalidEmailMsg })
    .nonempty({ message: requireMsg })


export const passwordValidator = ({
    minLength = 6,
    requireMsg = "Password is required",
    tooShortMsg = `Password must be at least ${minLength} characters`,
}: PasswordValidatorOptions) =>
    z
        .string()
        .nonempty({ message: requireMsg })
        .min(minLength, { message: tooShortMsg });

export const imageValidator = (message: string = "Invalid url") => z
    .string()
    .pipe(
        z.url({ message })
    )


export const slugValidator = (message: string = "Invalid url") => z
    .string()
    .regex(/^[a-z0-9-]+$/, {
        message
    })


export const colorValidator = (message: string = "Invalid color") => z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
        message
    })
    .optional()
    .or(z.literal(""))