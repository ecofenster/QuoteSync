import {createContext,useContext,type ReactNode} from "react";
export type EstimatePositionAction="up"|"down"|"duplicate"|"alternative"|"delete";
type Actions={openManufacturerImport:()=>void;configurePosition?:(positionId:string)=>void;positionAction?:(positionId:string,action:EstimatePositionAction)=>void};
const Context=createContext<Actions|null>(null);
export function EstimateCommercialActionsProvider({value,children}:{value:Actions;children:ReactNode}){return <Context.Provider value={value}>{children}</Context.Provider>}
export function useEstimateCommercialActions(){return useContext(Context)}
