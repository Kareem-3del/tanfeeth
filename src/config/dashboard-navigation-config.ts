import { FileText, FolderKanban, List, PlusCircle } from "lucide-react";

import { NavSection } from "@/types";

import { paths } from "./paths";

export const DashboardNavigation: NavSection[] = [
    {
        subheader: "dashboard.navigation.dashboard",
        id: "dashboard",
        items: [
            {
                title: "dashboard.navigation.projects",
                icon: FolderKanban,
                children: [
                    {
                        title: "dashboard.navigation.allProjects",
                        path: paths.dashboard.projects.index,
                        icon: List,
                    },
                    {
                        title: "dashboard.navigation.addProject",
                        path: paths.dashboard.projects.add,
                        icon: PlusCircle,
                    }
                ]
            },
            {
                title: "dashboard.navigation.contracts",
                icon: FileText,
                children: [
                    {
                        title: "dashboard.navigation.allContracts",
                        path: paths.dashboard.contracts.index,
                        icon: List,
                    },
                    {
                        title: "dashboard.navigation.addContract",
                        path: paths.dashboard.contracts.add,
                        icon: PlusCircle,
                    }
                ]
            }
        ]
    }
];