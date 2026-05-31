import { create } from "zustand";

import { Contract } from "../types/contract";
import { dummyContracts } from "../data";

const createId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
};

interface ContractsState {
    contracts: Contract[];
    addContract: (contract: Omit<Contract, "id">) => void;
    updateContract: (contract: Contract) => void;
    deleteContract: (id: string) => void;
    signContract: (id: string, signature: string) => void;
    sendContract: (id: string, sendTo: string) => void;
}

export const useContractsStore = create<ContractsState>((set) => ({
    contracts: dummyContracts,

    addContract: (contract) =>
        set((state) => ({
            contracts: [
                ...state.contracts,
                {
                    ...contract,
                    id: createId(),
                },
            ],
        })),

    updateContract: (contract) =>
        set((state) => ({
            contracts: state.contracts.map((item) =>
                item.id === contract.id ? { ...item, ...contract } : item
            ),
        })),

    deleteContract: (id) =>
        set((state) => ({
            contracts: state.contracts.filter((item) => item.id !== id),
        })),

    signContract: (id, signature) =>
        set((state) => ({
            contracts: state.contracts.map((item) =>
                item.id === id ? { ...item, signature, isSigned: true } : item
            ),
        })),

    sendContract: (id, sendTo) =>
        set((state) => ({
            contracts: state.contracts.map((item) =>
                item.id === id ? { ...item, sendTo, isSent: true } : item
            ),
        })),
}));
