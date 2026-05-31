// lib/i18n/messages.ts

// Static imports for type inference only
import fs from "fs";
import path from "path";

import type commonMessages from "@/messages/ar/common.json";
import type contractsMessages from "@/messages/ar/contracts.json";
import type homeMessages from "@/messages/ar/home.json";
import type layoutDataMessages from "@/messages/ar/layout.json";
import type metaDataMessages from "@/messages/ar/metaData.json";
import { SupportedLocale } from "@/types";

export type MessagesData = {
    home: typeof homeMessages;
    metaData: typeof metaDataMessages;
    layout: typeof layoutDataMessages;
    common: typeof commonMessages;
    contracts: typeof contractsMessages;
};


export const getMessagesData = async (locale: SupportedLocale) => {
    const baseDir = path.join(process.cwd(), 'src/messages', locale);

    const loadFile = (fileName: string) => {
        const filePath = path.join(baseDir, `${fileName}.json`);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(fileContent);
    };

    return {
        home: loadFile('home'),
        metaData: loadFile('metaData'),
        layout: loadFile('layout'),
        common: loadFile('common'),
        contracts: loadFile('contracts'),
    };
};