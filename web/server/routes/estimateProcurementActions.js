import express from "express";
import { CURRENT_APP_USER } from "../currentUser.js";
import { createEstimateProcurementActionService } from "../features/estimates/estimateProcurementActionService.js";

const fail=(res,reason)=>res.status(Number(reason?.status)||500).json({error:reason instanceof Error?reason.message:"Estimate procurement action failed.",code:reason?.code||"estimate_procurement_action_failed",...(reason?.details||{})});

export function createEstimateProcurementActionsRouter({databasePromise}={}){
  if(!databasePromise)throw new Error("Estimate procurement action router requires an explicit databasePromise.");
  const router=express.Router(),service=async()=>createEstimateProcurementActionService(await databasePromise);
  router.get("/:estimateId/procurement-actions",async(req,res)=>{try{return res.json(await(await service()).availability(req.params.estimateId))}catch(reason){return fail(res,reason)}});
  router.post("/:estimateId/procurement-actions/request-supplier-revision",async(req,res)=>{try{return res.status(201).json(await(await service()).requestSupplierRevision(req.params.estimateId,{...req.body,idempotencyKey:req.get("Idempotency-Key")},CURRENT_APP_USER.id))}catch(reason){return fail(res,reason)}});
  router.post("/:estimateId/procurement-actions/raise-order-to-factory",async(req,res)=>{try{return res.status(202).json(await(await service()).raiseOrderToFactory(req.params.estimateId,req.body||{},CURRENT_APP_USER.id))}catch(reason){return fail(res,reason)}});
  return router;
}
