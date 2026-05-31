import { z } from "zod";

export const ContractFormSchema = (t: any) =>
    z.object({
        id: z.string().optional(),
        // --- الهوية والبيانات الأساسية ---
        name: z.string().min(1, { message: t("validation.required") }),
        contractNumber: z.string().min(1, { message: t("validation.required") }),
        serialNumber: z.string().min(1, { message: t("validation.required") }),
        contractorName: z.string().min(1, { message: t("validation.required") }),
        projectOwnerName: z.string().min(1, { message: t("validation.required") }),
        responsibleEmployee: z.string().min(1, { message: t("validation.required") }),
        supervisingDepartment: z.string().min(1, { message: t("validation.required") }),
        contractStatus: z.string().min(1, { message: t("validation.required") }),
        year: z.string().min(4, { message: t("validation.invalidYear") }),

        // --- القيم المالية ---
        contractValue: z.coerce.number().min(0, { message: t("validation.minZero") }),
        amendedValue: z.coerce.number().min(0, { message: t("validation.minZero") }).optional(),
        bankGuaranteeValue: z.coerce.number().min(0, { message: t("validation.minZero") }),
        spentAmount: z.coerce.number().min(0, { message: t("validation.minZero") }),
        completionPercentage: z.coerce.number().min(0).max(100, { message: t("validation.range0to100") }),
        spentPercentageFromContract: z.coerce.number().min(0).max(100, { message: t("validation.range0to100") }),

        // --- التواريخ ---
        signingDate: z.string().min(1, { message: t("validation.required") }),
        startDate: z.string().min(1, { message: t("validation.required") }),
        endDate: z.string().min(1, { message: t("validation.required") }),
        initialDeliveryDate: z.string().nullable().optional(),
        finalDeliveryDate: z.string().nullable().optional(),
        amendmentOrderDate: z.string().nullable().optional(),
        tenderNotificationDate: z.string().nullable().optional(),
        tenderDate: z.string().nullable().optional(),
        bankGuaranteeEndDate: z.string().nullable().optional(),
        contractAmendedDurationEndDate: z.string().nullable().optional(),
        awardingCommitteeSignatureDate: z.string().nullable().optional(),
        tenderOpeningDate: z.string().nullable().optional(),

        // --- حقول إضافية ---
        amendmentOrdersCount: z.coerce.number().int().min(0).optional(),
        contractDuration: z.string().optional(),
        amendedContractDuration: z.string().optional(),
        tenderCommitteeNumber: z.string().optional(),
        purchaseOrderNumber: z.string().optional(),
        projectClassification: z.string().optional(),
        tenderType: z.string().optional(),
        competitionReferenceNumber: z.string().optional(),
        bankGuaranteeReferenceNumber: z.string().optional(),
        projectType: z.string().optional(),
        sapPurchaseRequestNumber: z.string().optional(),
        approved: z.boolean().optional(),
        signature: z.string().optional(),
        sendTo: z.string().optional(),
        isSigned: z.boolean().optional(),
        isSent: z.boolean().optional(),
    })
        // --- المنطق المتقدم (Full Validation) ---
        .superRefine((data, ctx) => {
            // 1. تاريخ النهاية بعد البداية
            if (data.endDate && data.startDate && new Date(data.endDate) <= new Date(data.startDate)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t("validation.dates.endAfterStart"),
                    path: ["endDate"],
                });
            }

            // 2. المبلغ المصروف لا يتجاوز قيمة العقد
            if (data.spentAmount > data.contractValue) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t("validation.spentExceedsValue"),
                    path: ["spentAmount"],
                });
            }

            // 3. تاريخ انتهاء الضمان البنكي يجب أن يكون مستقبلياً
            if (data.bankGuaranteeEndDate && new Date(data.bankGuaranteeEndDate) < new Date()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t("validation.bankGuaranteeExpired"),
                    path: ["bankGuaranteeEndDate"],
                });
            }
        });

export type ContractFormValues = z.infer<ReturnType<typeof ContractFormSchema>>;