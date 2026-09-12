import path from 'node:path';

export function isolatedJourneyMode(environment=process.env){
 const root=path.dirname(path.resolve(environment.QUOTESUITE_DB_PATH||''));
 const factoryDelivery=['factory-send','factory-reconcile','supplier-followup'].includes(environment.QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY);
 const delivery=factoryDelivery||environment.QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY==='customer-reissue';
 const allowed=delivery?environment.QUOTESUITE_TEST_DELIVERY_ENABLED==='1'&&environment.QUOTESUITE_TEST_CUSTOMER_EMAIL==='customer.journey@example.test'&&environment.QUOTESUITE_TEST_FACTORY_EMAIL==='factory.journey@example.test':environment.QUOTESUITE_TEST_DELIVERY_ENABLED==='0'&&!environment.QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY;
 if(environment.NODE_ENV!=='development'||environment.QUOTESUITE_TEST_JOURNEY!=='1'||!path.basename(root).startsWith('quotesuite-complete-journey-')||!allowed)throw new Error('Disposable provider requires the owned delivery-disabled journey workspace or explicit no-network customer-reissue mode.');
 return {root,delivery,factoryDelivery};
}
