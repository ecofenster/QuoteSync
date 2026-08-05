import express from 'express';
import { createProjectCalculatorLabService } from '../features/projectCalculatorLab/projectCalculatorLabService.js';

const fail=(res,status,code,message)=>res.status(status).json({code,error:message});

export async function createProjectCalculatorLabRouter({dbPromise}) {
  const router=express.Router();
  const service=createProjectCalculatorLabService(await dbPromise);
  router.get('/import-sources',async(_req,res,next)=>{try{res.json(await service.listImportSources());}catch(error){next(error);}});
  router.get('/scenarios',async(_req,res,next)=>{try{res.json(await service.listScenarios());}catch(error){next(error);}});
  router.post('/scenarios',async(req,res,next)=>{try{res.status(201).json(await service.createScenario(req.body||{}));}catch(error){if(['source_not_found','invalid_scenario'].includes(error.code))return fail(res,error.code==='source_not_found'?404:400,error.code,error.message);next(error);}});
  router.get('/scenarios/:scenarioId',async(req,res,next)=>{try{const value=await service.getScenario(req.params.scenarioId);return value?res.json(value):fail(res,404,'scenario_not_found','Calculator scenario not found.');}catch(error){next(error);}});
  router.patch('/scenarios/:scenarioId',async(req,res,next)=>{try{const value=await service.updateScenario(req.params.scenarioId,req.body||{});return value?res.json(value):fail(res,404,'scenario_not_found','Calculator scenario not found.');}catch(error){if(error.code==='invalid_scenario')return fail(res,400,error.code,error.message);next(error);}});
  router.patch('/scenarios/:scenarioId/products/:rowId',async(req,res,next)=>{try{const value=await service.updateProduct(req.params.scenarioId,req.params.rowId,req.body||{});return value?res.json(value):fail(res,404,'product_not_found','Calculator product row not found.');}catch(error){if(error.code==='invalid_product')return fail(res,400,error.code,error.message);next(error);}});
  router.patch('/scenarios/:scenarioId/package-items/:itemId',async(req,res,next)=>{try{const value=await service.updatePackageItem(req.params.scenarioId,req.params.itemId,req.body||{});return value?res.json(value):fail(res,404,'package_item_not_found','Package item not found.');}catch(error){if(error.code==='invalid_cost')return fail(res,400,error.code,error.message);next(error);}});
  router.post('/scenarios/:scenarioId/route-snapshots',async(req,res,next)=>{try{const value=await service.appendRouteSnapshot(req.params.scenarioId,req.body||{});return value?res.status(201).json(value):fail(res,404,'scenario_not_found','Calculator scenario not found.');}catch(error){if(error.code==='invalid_route')return fail(res,400,error.code,error.message);next(error);}});
  router.use((error,req,res,_next)=>{console.error('Project Calculator Lab request failed',{method:req.method,code:error?.code||'calculator_lab_failure'});return fail(res,500,'calculator_lab_failure','Project Calculator Lab operation failed.');});
  return router;
}
