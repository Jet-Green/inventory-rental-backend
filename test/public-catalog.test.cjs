const {test} = require('node:test');
const assert = require('node:assert/strict');
const {RentalListingService} = require('../dist/modules/rental-listing/rental-listing.service');
const {ListingsPublicController} = require('../dist/modules/rental-listing/listings.public.controller');
const {validatePublicCatalogQuery} = require('../dist/modules/rental-listing/public-catalog-query');
const doc = (id, units=5) => ({_id:{toString:()=>id},moderationStatus:'active',unitsTotal:units,unitsAvailable:0,photos:[],pickupType:'both'});
function harness(rows, bookings=[]) {
  let captured;
  const model={find(q){captured=q;const chain={skip(){return chain},limit(){return chain},sort(){return chain},exec:async()=>rows};return chain},countDocuments:async()=>rows.length};
  const booking={find(q){assert.deepEqual(q.status.$in,['pending','confirmed','active']);return {select(){return {setOptions(options){assert.equal(options.autopopulate,false);return {exec:async()=>bookings}}}}}}};
  return {service:new RentalListingService(model,booking),query:()=>captured};
}
test('strict date, price, quantity and enum validation',()=>{
  for(const q of [{dateFrom:'2026-12-01'},{dateFrom:'2026-02-30',dateTo:'2026-03-03'},{dateFrom:'2026-12-03',dateTo:'2026-12-01'},{priceFrom:'NaN'},{unitsNeeded:'1.2'},{page:'-1'},{pickupMethod:'both'},{priceFrom:'2',priceTo:'1'}]) assert.throws(()=>validatePublicCatalogQuery(q));
  validatePublicCatalogQuery({dateFrom:'2026-12-01',dateTo:'2026-12-03',unitsNeeded:'2',priceFrom:'0'});
});
test('catalog active scope, pickup includes both, search literal and date stock uses total',async()=>{
  const h=harness([]);await h.service.getCatalog({filters:{pickupType:'delivery',search:'a.*',unitsNeeded:2,dateFrom:'2026-12-01',dateTo:'2026-12-03'}});
  assert.equal(h.query().moderationStatus,'active');assert.deepEqual(h.query().pickupType,{$in:['delivery','both']});assert.deepEqual(h.query().unitsTotal,{$gte:2});assert.equal(h.query().$or[0].title.$regex,'a\\.\\*');
});
test('sweep availability counts overlap, not sum; adjacent and cancelled excluded by query',async()=>{
  const h=harness([doc('1')],[{listingId:'1',dateFrom:'2026-12-01',dateTo:'2026-12-02',units:3},{listingId:'1',dateFrom:'2026-12-02',dateTo:'2026-12-03',units:2},{listingId:'1',dateFrom:'2026-11-30',dateTo:'2026-12-01',units:5}]);
  const r=await h.service.getCatalog({filters:{dateFrom:'2026-12-01',dateTo:'2026-12-03',unitsNeeded:2}});assert.equal(r.total,1);assert.equal(r.data[0].unitsAvailable,2);
  const none=await h.service.getCatalog({filters:{dateFrom:'2026-12-01',dateTo:'2026-12-03',unitsNeeded:3}});assert.equal(none.total,0);
});
test('public detail blocks all nonactive statuses and invalid identifiers',async()=>{
  for(const status of ['draft','hidden','pending','rejected']) await assert.rejects(new ListingsPublicController({getById:async()=>({...doc('1'),moderationStatus:status})}).getById('6ae620e8fb45e4ba0ee52cb7'),{status:404});
  await assert.rejects(new ListingsPublicController({}).getById('bad'),{status:404});
  assert.ok((await new ListingsPublicController({getById:async()=>doc('1')}).getById('6ae620e8fb45e4ba0ee52cb7')).listing);
});
test('public endpoint passes dates into existing availability service',async()=>{
  let payload;const controller=new ListingsPublicController({getCatalog:async p=>{payload=p;return {data:[],page:1,total:0,totalPages:0}}});
  await controller.list(undefined,undefined,undefined,undefined,undefined,undefined,undefined,'2',undefined,'2026-12-01','2026-12-03');
  assert.equal(payload.filters.dateFrom,'2026-12-01');assert.equal(payload.filters.unitsNeeded,2);
});
