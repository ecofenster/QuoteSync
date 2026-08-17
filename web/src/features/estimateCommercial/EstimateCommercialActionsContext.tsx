import {createContext,useContext,type ReactNode} from "react";
type Actions={openManufacturerImport:()=>void};
const Context=createContext<Actions|null>(null);
export function EstimateCommercialActionsProvider({value,children}:{value:Actions;children:ReactNode}){return <Context.Provider value={value}>{children}</Context.Provider>}
export function useEstimateCommercialActions(){return useContext(Context)}
