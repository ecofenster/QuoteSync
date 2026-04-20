import type { AppUser, UserRole } from "../models/types";

export const APP_USER_ROLES: UserRole[] = [
  "estimator",
  "client_account_manager",
  "accounts",
  "administrator",
];

export const CURRENT_APP_USER: AppUser = {
  id: "user-1",
  name: "User",
  role: "estimator",
};
