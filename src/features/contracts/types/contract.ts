export interface Contract {
    id: string;

    name: string;
    amendmentOrdersCount: number;
    signingDate: string;
    initialDeliveryDate: string;
    amendedContractDuration: string;
    responsibleEmployee: string;
    tenderCommitteeNumber: string;
    bankGuaranteeValue: number;
    supervisingDepartment: string;
    purchaseOrderNumber: string;
    completionPercentage: number;
    projectClassification: string;

    contractNumber: string;
    contractValue: number;
    amendmentOrderDate: string;
    endDate: string;
    contractDuration: string;
    year: string;
    tenderNotificationDate: string;
    tenderDate: string;
    bankGuaranteeEndDate: string;
    tenderType: string;
    competitionReferenceNumber: string;
    spentPercentageFromContract: number;
    contractStatus: string;

    serialNumber: string;
    contractorName: string;
    amendedValue: number;
    startDate: string;
    finalDeliveryDate: string;
    contractAmendedDurationEndDate: string;
    awardingCommitteeSignatureDate: string;
    tenderOpeningDate: string;
    bankGuaranteeReferenceNumber: string;
    projectType: string;
    sapPurchaseRequestNumber: string;
    spentAmount: number;
    projectOwnerName: string;
    approved?: boolean;
    signature?: string;
    sendTo?: string;
    isSigned?: boolean;
    isSent?: boolean;
}