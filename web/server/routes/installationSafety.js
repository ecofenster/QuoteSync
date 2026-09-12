import express from "express";
import {dbPromise} from "../db.js";
import {createInstallationSafetyService} from "../features/installationSafety/installationSafetyService.js";

const sendError=(res,error)=>res.status(Number(error?.status)||500).json({error:Number(error?.status)?error.message:"Installation documents could not be processed.",code:error?.code||"installation_safety_failure"});
export function createInstallationSafetyRouter({databasePromise=dbPromise,serviceOptions={}}={}){
  const router=express.Router();
  router.get("/estimates/:estimateId/rams",async(req,res)=>{try{res.json(await createInstallationSafetyService(await databasePromise,serviceOptions).listForEstimate(req.params.estimateId))}catch(error){sendError(res,error)}});
  router.post("/estimates/:estimateId/rams",async(req,res)=>{try{res.status(201).json(await createInstallationSafetyService(await databasePromise,serviceOptions).create(req.params.estimateId,req.body||{}))}catch(error){sendError(res,error)}});
  router.get("/rams/:ramsId",async(req,res)=>{try{res.json(await createInstallationSafetyService(await databasePromise,serviceOptions).get(req.params.ramsId))}catch(error){sendError(res,error)}});
  router.put("/rams/:ramsId/draft",async(req,res)=>{try{res.json(await createInstallationSafetyService(await databasePromise,serviceOptions).saveDraft(req.params.ramsId,req.body||{}))}catch(error){sendError(res,error)}});
  router.post("/rams/:ramsId/issue",async(req,res)=>{try{res.json(await createInstallationSafetyService(await databasePromise,serviceOptions).issue(req.params.ramsId,req.body||{}))}catch(error){sendError(res,error)}});
  router.post("/rams/:ramsId/revisions",async(req,res)=>{try{res.status(201).json(await createInstallationSafetyService(await databasePromise,serviceOptions).newRevision(req.params.ramsId))}catch(error){sendError(res,error)}});
  router.post("/rams/:ramsId/briefings",async(req,res)=>{try{res.status(201).json(await createInstallationSafetyService(await databasePromise,serviceOptions).acknowledge(req.params.ramsId,req.body||{}))}catch(error){sendError(res,error)}});
  router.get("/rams/:ramsId/versions/:version/pdf",async(req,res)=>{try{const result=await createInstallationSafetyService(await databasePromise,serviceOptions).readPdf(req.params.ramsId,req.params.version);res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`inline; filename="${result.fileName.replace(/["\r\n]/g,"")}"`);res.setHeader("ETag",`"${result.sha256}"`);res.send(result.bytes)}catch(error){sendError(res,error)}});
  return router;
}
