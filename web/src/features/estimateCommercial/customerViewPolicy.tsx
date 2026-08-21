import { createContext, useContext } from "react";

export type CustomerViewPolicy = { room:boolean;dimensions:boolean;itemPrice:boolean;quantityPrice:boolean;alternative:boolean;quickConfigurator:boolean;duplicate:boolean;reorder:boolean;manufacturerImport:boolean;customerQuotation:boolean };
export const DEFAULT_CUSTOMER_VIEW_POLICY:CustomerViewPolicy={room:true,dimensions:true,itemPrice:true,quantityPrice:true,alternative:true,quickConfigurator:true,duplicate:true,reorder:true,manufacturerImport:true,customerQuotation:true};
const Context=createContext(DEFAULT_CUSTOMER_VIEW_POLICY);
export const CustomerViewPolicyProvider=Context.Provider;
export const useCustomerViewPolicy=()=>useContext(Context);
