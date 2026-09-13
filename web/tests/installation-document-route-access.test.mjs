import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createInstallationDocumentsRouter} from '../server/routes/installationDocuments.js';

test('installation document routes deny production and untrusted browser origins before database access',async()=>{
  for(const [environment,origin] of [[{NODE_ENV:'production'},'http://localhost:5173'],[{NODE_ENV:'development'},'https://untrusted.example']]){
    let accessed=false;const databasePromise={then(){accessed=true;throw new Error('Database must not be accessed');}};
    const app=express();app.use('/api/installation-documents',createInstallationDocumentsRouter({databasePromise,environment}));
    const server=await new Promise(resolve=>{const owned=app.listen(0,'127.0.0.1',()=>resolve(owned));});
    try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/installation-documents/estimates/test`,{headers:{Origin:origin}});assert.equal(response.status,403);assert.equal(accessed,false);assert.match((await response.json()).error,/restricted/);}
    finally{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  }
});
