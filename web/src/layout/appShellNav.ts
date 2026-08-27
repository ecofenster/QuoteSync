export type AppShellMenuItem = {
  key: string;
  label: string;
  children?: AppShellMenuItem[];
};

export const appShellMenuItems: AppShellMenuItem[] = [
  { key: "home", label: "Home" },
  {
    key: "create",
    label: "Create",
    children: [
      { key: "create_enquiry", label: "Create Enquiry" },
      { key: "create_estimate", label: "Create Estimate" },
      { key: "create_client", label: "Create Client" },
      { key: "phpp", label: "PHPP" },
      { key: "glass_calculator", label: "Glass Calculator" },
    ],
  },
  { key: "tools", label: "Tools" },
  { key: "help", label: "Help" },
  { key: "admin", label: "Admin" },
];
