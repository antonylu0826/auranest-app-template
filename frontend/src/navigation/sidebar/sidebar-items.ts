import { type LucideIcon, Home, Users } from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  isNew?: boolean;
  adminOnly?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
  adminOnly?: boolean;
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    items: [
      {
        title: "home",
        url: "/dashboard",
        icon: Home,
      },
    ],
  },
  {
    id: 2,
    label: "admin",
    adminOnly: true,
    items: [
      {
        title: "users",
        url: "/dashboard/users",
        icon: Users,
        adminOnly: true,
      },
    ],
  },
];
