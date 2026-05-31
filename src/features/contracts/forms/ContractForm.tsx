"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { navigate } from "next/dist/client/components/segment-cache/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";


import ActionButton from "@/components/shared/action-button";
import { Button } from "@/components/ui/button";
import { useAppTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";
import { FormDatePicker } from "@/shared/form/components/inputs/FormDatePicker";
import { FormTextField } from "@/shared/form/components/inputs/FormTextField";
import { FormContainer } from "@/shared/form/components/layout/FormContainer";
import { FormSection } from "@/shared/form/components/layout/FormSection";
import { AppFormProvider } from "@/shared/form/providers/AppFormProvider";
import { errorMapper } from "@/utils/error";

import { ContractPreview } from "../components/ContractPreview";
import { ContractFormValues, ContractFormSchema } from "../schemas/contract-schema";
import { Contract } from "../types/contract";


interface ContractFormProps {
    contract?: Contract;
}

function setDefaultValues(contract?: Contract): ContractFormValues {
    return {
        id: contract?.id || "",
        name: contract?.name || "",
        contractNumber: contract?.contractNumber || "",
        serialNumber: contract?.serialNumber || "",
        contractorName: contract?.contractorName || "",
        projectOwnerName: contract?.projectOwnerName || "",
        responsibleEmployee: contract?.responsibleEmployee || "",
        supervisingDepartment: contract?.supervisingDepartment || "",
        contractStatus: contract?.contractStatus || "",
        year: contract?.year || "",
        contractValue: contract?.contractValue || 0,
        amendedValue: contract?.amendedValue || 0,
        bankGuaranteeValue: contract?.bankGuaranteeValue || 0,
        spentAmount: contract?.spentAmount || 0,
        completionPercentage: contract?.completionPercentage || 0,
        spentPercentageFromContract: contract?.spentPercentageFromContract || 0,
        signingDate: contract?.signingDate || "",
        startDate: contract?.startDate || "",
        endDate: contract?.endDate || "",
        initialDeliveryDate: contract?.initialDeliveryDate || null,
        finalDeliveryDate: contract?.finalDeliveryDate || null,
        amendmentOrderDate: contract?.amendmentOrderDate || null,
        tenderNotificationDate: contract?.tenderNotificationDate || null,
        tenderDate: contract?.tenderDate || null,
        bankGuaranteeEndDate: contract?.bankGuaranteeEndDate || null,
        contractAmendedDurationEndDate: contract?.contractAmendedDurationEndDate || null,
        awardingCommitteeSignatureDate: contract?.awardingCommitteeSignatureDate || null,
        tenderOpeningDate: contract?.tenderOpeningDate || null,
        amendmentOrdersCount: contract?.amendmentOrdersCount || 0,
        contractDuration: contract?.contractDuration || "",
        amendedContractDuration: contract?.amendedContractDuration || "",
        tenderCommitteeNumber: contract?.tenderCommitteeNumber || "",
        purchaseOrderNumber: contract?.purchaseOrderNumber || "",
        projectClassification: contract?.projectClassification || "",
        tenderType: contract?.tenderType || "",
        competitionReferenceNumber: contract?.competitionReferenceNumber || "",
        bankGuaranteeReferenceNumber: contract?.bankGuaranteeReferenceNumber || "",
        projectType: contract?.projectType || "",
        sapPurchaseRequestNumber: contract?.sapPurchaseRequestNumber || "",
    }
}

export function ContractForm({ contract }: ContractFormProps) {
    const t = useAppTranslation("contracts");
    const tCommon = useAppTranslation("common");
    const [activeStep, setActiveStep] = useState(1);

    const methods = useForm<ContractFormValues>({
        resolver: zodResolver(ContractFormSchema(t) as any),
        defaultValues: setDefaultValues(contract)
    });

    const { reset, watch } = methods;

    // eslint-disable-next-line react-hooks/incompatible-library
    const watchedData = watch();

    const onsubmit = async (data: ContractFormValues) => {
        try {
            // تنفيذ الـ API هنا
            console.log("Submitted Data:", data);
            reset({
                ...setDefaultValues
            });
        } catch (error) {
            errorMapper(error).forEach((err) => toast.error(err));
        }
    };

    return (
        <AppFormProvider<ContractFormValues> methods={methods} onSubmit={onsubmit}>
            <FormContainer
                submitText={contract ? tCommon("actions.edit") : tCommon("actions.create")}
                action={watch("id") && <ActionButton >
                    {t("actions.sign")}
                </ActionButton>
                }
            >

                <FormSection
                    title={t("sections.basicInfo")}
                    gridCols={2}
                    stepNumber={1}
                    isActive={activeStep >= 1}
                    onVisible={() => setActiveStep(1)}
                >
                    <FormTextField name="name" label={t("fields.name")} required />
                    <FormTextField name="contractNumber" label={t("fields.contractNumber")} required />
                    <FormTextField name="serialNumber" label={t("fields.serialNumber")} required />
                    <FormTextField name="contractorName" label={t("fields.contractorName")} required />
                    <FormTextField name="projectOwnerName" label={t("fields.projectOwnerName")} required />
                    <FormTextField name="responsibleEmployee" label={t("fields.responsibleEmployee")} required />
                    <FormTextField name="supervisingDepartment" label={t("fields.supervisingDepartment")} required />
                    <FormTextField name="contractStatus" label={t("fields.contractStatus")} required />
                    <FormTextField name="year" label={t("fields.year")} required />
                </FormSection>

                <FormSection
                    title={t("sections.financial")}
                    gridCols={2}
                    stepNumber={2}
                    isActive={activeStep >= 2}
                    onVisible={() => setActiveStep(2)}
                >
                    <FormTextField name="contractValue" label={t("fields.contractValue")} type="number" required />
                    <FormTextField name="amendedValue" label={t("fields.amendedValue")} type="number" />
                    <FormTextField name="bankGuaranteeValue" label={t("fields.bankGuaranteeValue")} type="number" required />
                    <FormTextField name="spentAmount" label={t("fields.spentAmount")} type="number" required />
                    <FormTextField name="completionPercentage" label={t("fields.completionPercentage")} type="number" />
                    <FormTextField name="spentPercentageFromContract" label={t("fields.spentPercentageFromContract")} type="number" />
                </FormSection>

                <FormSection
                    title={t("sections.dates")}
                    gridCols={2}
                    stepNumber={3}
                    isActive={activeStep >= 3}
                    onVisible={() => setActiveStep(3)}
                >
                    <FormDatePicker name="signingDate" label={t("fields.signingDate")} />
                    <FormDatePicker name="startDate" label={t("fields.startDate")} />
                    <FormDatePicker name="endDate" label={t("fields.endDate")} />
                    <FormDatePicker name="initialDeliveryDate" label={t("fields.initialDeliveryDate")} />
                    <FormDatePicker name="finalDeliveryDate" label={t("fields.finalDeliveryDate")} />
                    <FormDatePicker name="amendmentOrderDate" label={t("fields.amendmentOrderDate")} />
                    <FormDatePicker name="tenderNotificationDate" label={t("fields.tenderNotificationDate")} />
                    <FormDatePicker name="tenderDate" label={t("fields.tenderDate")} />
                    <FormDatePicker name="bankGuaranteeEndDate" label={t("fields.bankGuaranteeEndDate")} />
                    <FormDatePicker name="contractAmendedDurationEndDate" label={t("fields.contractAmendedDurationEndDate")} />
                    <FormDatePicker name="awardingCommitteeSignatureDate" label={t("fields.awardingCommitteeSignatureDate")} />
                    <FormDatePicker name="tenderOpeningDate" label={t("fields.tenderOpeningDate")} />
                </FormSection>

                <FormSection
                    title={t("sections.additional")}
                    gridCols={2}
                    stepNumber={4}
                    isActive={activeStep >= 4}
                    onVisible={() => setActiveStep(4)}
                >
                    <FormTextField name="amendmentOrdersCount" label={t("fields.amendmentOrdersCount")} type="number" />
                    <FormTextField name="contractDuration" label={t("fields.contractDuration")} />
                    <FormTextField name="amendedContractDuration" label={t("fields.amendedContractDuration")} />
                    <FormTextField name="tenderCommitteeNumber" label={t("fields.tenderCommitteeNumber")} />
                    <FormTextField name="purchaseOrderNumber" label={t("fields.purchaseOrderNumber")} />
                    <FormTextField name="projectClassification" label={t("fields.projectClassification")} />
                    <FormTextField name="tenderType" label={t("fields.tenderType")} />
                    <FormTextField name="competitionReferenceNumber" label={t("fields.competitionReferenceNumber")} />
                    <FormTextField name="bankGuaranteeReferenceNumber" label={t("fields.bankGuaranteeReferenceNumber")} />
                    <FormTextField name="projectType" label={t("fields.projectType")} />
                    <FormTextField name="sapPurchaseRequestNumber" label={t("fields.sapPurchaseRequestNumber")} />
                </FormSection>

                <div className="mt-10">
                    <ContractPreview data={watchedData} />
                </div>

            </FormContainer>


        </AppFormProvider >
    );
}