import express from 'express';
import { CURRENT_APP_USER } from '../currentUser.js';
import { createLifecycleService } from '../features/lifecycle/lifecycleService.js';

const fail = (res, error) => res.status(Number(error?.status) || 500).json({ error: error instanceof Error ? error.message : 'Lifecycle request failed.', code: error?.code || 'lifecycle_error' });
export function createLifecycleRouter({ databasePromise, serviceOptions } = {}) {
  if (!databasePromise) throw new Error('createLifecycleRouter requires databasePromise.');
  const router = express.Router(), service = async () => createLifecycleService(await databasePromise, serviceOptions);
  router.get('/test-delivery', async (_req,res) => res.json((await service()).deliveryStatus()));
  router.get('/changes-requested', async (_req,res) => { try { res.json(await (await service()).changesRequestedQueue()); } catch (error) { fail(res,error); } });
  router.get('/changes-requested/:reviewId', async (req,res) => { try { res.json(await (await service()).changeRequestDetail(req.params.reviewId)); } catch (error) { fail(res,error); } });
  router.get('/projects/:projectId/supplier-enquiries',async(req,res)=>{try{res.json(await(await service()).supplierEnquiryContext(req.params.projectId,req.query.estimate_id));}catch(error){fail(res,error);}});
  router.post('/projects/:projectId/supplier-enquiries',async(req,res)=>{try{res.status(201).json(await(await service()).prepareSupplierEnquiry(req.params.projectId,{...req.body,createdBy:CURRENT_APP_USER.id}));}catch(error){fail(res,error);}});
  router.post('/projects/:projectId/manufacturer-responses',async(req,res)=>{try{res.status(201).json(await(await service()).linkManufacturerResponse(req.params.projectId,{...req.body,createdBy:CURRENT_APP_USER.id}));}catch(error){fail(res,error);}});
  router.put('/supplier-enquiries/:supplierEnquiryId/response-due',async(req,res)=>{try{res.json(await(await service()).updateSupplierResponseDue(req.params.supplierEnquiryId,req.body));}catch(error){fail(res,error);}});
  router.post('/supplier-enquiries/:supplierEnquiryId/followup-retry',async(req,res)=>{try{res.json(await(await service()).retrySupplierRevisionFollowup(req.params.supplierEnquiryId));}catch(error){fail(res,error);}});
  router.post('/changes-requested/:reviewId/supplier-revision', async (req,res) => { try { res.status(201).json(await (await service()).prepareSupplierRevision({ ...req.body, reviewSubmissionId:req.params.reviewId, createdBy:CURRENT_APP_USER.id, createdByName:CURRENT_APP_USER.name })); } catch(error){ fail(res,error); } });
  router.get('/supplier-revisions/:requestId', async (req,res) => { try { res.json(await (await service()).supplierRevisionDetail(req.params.requestId)); } catch(error){ fail(res,error); } });
  router.post('/supplier-revisions/:requestId/correspondence', async (req,res) => { try { res.json(await (await service()).prepareSupplierRevisionCorrespondence(req.params.requestId,{ ...req.body, reviewedBy:CURRENT_APP_USER.id })); } catch(error){ fail(res,error); } });
  router.post('/supplier-revisions/:requestId/returned-document', async (req,res) => { try { res.json(await (await service()).attachSupplierRevisionDocument(req.params.requestId,{ ...req.body, reviewedBy:CURRENT_APP_USER.id })); } catch(error){ fail(res,error); } });
  router.put('/supplier-revisions/:requestId/verification', async (req,res) => { try { res.json(await (await service()).verifySupplierRevision(req.params.requestId,{ ...req.body, reviewedBy:CURRENT_APP_USER.id })); } catch(error){ fail(res,error); } });
  router.post('/orders/:orderId/staff-approval', async (req,res) => { try { res.status(201).json(await (await service()).approveOrder(req.params.orderId,{ ...req.body, approvedBy:CURRENT_APP_USER.id })); } catch(error){ fail(res,error); } });
  router.get('/orders/:orderId', async (req,res) => { try { res.json(await (await service()).orderJourney(req.params.orderId)); } catch(error){ fail(res,error); } });
  router.post('/orders/:orderId/factory-order', async (req,res) => { try { res.status(201).json(await (await service()).prepareFactoryOrder(req.params.orderId,{ ...req.body, createdBy:CURRENT_APP_USER.id })); } catch(error){ fail(res,error); } });
  router.post('/orders/:orderId/factory-confirmations', async (req,res) => { try { res.status(201).json(await (await service()).recordFactoryConfirmation(req.params.orderId,{ ...req.body, createdBy:CURRENT_APP_USER.id, reviewedBy:CURRENT_APP_USER.id })); } catch(error){ fail(res,error); } });
  router.post('/factory-confirmations/:confirmationId/release', async (req,res) => { try { res.status(201).json(await (await service()).releaseFactoryConfirmation(req.params.confirmationId,{ ...req.body, releasedBy:CURRENT_APP_USER.id })); } catch(error){ fail(res,error); } });
  router.post('/factory-confirmation-releases/:releaseId/signed-approval', async (req,res) => { try { res.status(201).json(await (await service()).recordReviewedSignedApproval(req.params.releaseId,{ ...req.body, reviewedBy:CURRENT_APP_USER.id })); } catch(error){ fail(res,error); } });
  router.get('/documents/:documentId', async (req,res) => { try { const file=await (await service()).customerDocuments.read(req.params.documentId);if(!file)return res.status(404).json({error:'Customer lifecycle document was not found.'});res.setHeader('Content-Type',file.document.mediaType);res.setHeader('Content-Disposition',`inline; filename=\"${file.document.fileName.replaceAll('"','')}\"`);res.setHeader('Content-Length',String(file.bytes.length));return res.send(file.bytes);}catch(error){return fail(res,error);} });
  return router;
}
