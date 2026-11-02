import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

process.env.TZ='America/Los_Angeles';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const noNetwork=()=>{throw new Error('External services are disabled in local tests');};
const utilities={
  formatDate(date,zone,format){
    if(format==='yyyy-MM-dd')return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
    return date.toISOString();
  },
  parseDate(iso,zone){assert.equal(zone,'America/Los_Angeles');return new Date(iso);},
  base64Encode(value){return Buffer.from(value).toString('base64');}
};
function contextFor(folder,extra={}){
  const ctx=vm.createContext({console,Date,Set,Map,JSON,Intl,Utilities:utilities,Logger:{log(){}},CalendarApp:{getCalendarById:noNetwork},GmailApp:{sendEmail:noNetwork},UrlFetchApp:{fetch:noNetwork},...extra});
  for(const file of ['Config.gs','Code.gs'])vm.runInContext(fs.readFileSync(path.join(root,'workflows',folder,file),'utf8'),ctx,{filename:file});
  return ctx;
}

const coverage=contextFor('cleaning-coverage');
assert.throws(()=>coverage.dailyCleaningCheck(),/disabled/);
vm.runInContext(fs.readFileSync(path.join(root,'workflows/cleaning-coverage/tests.gs'),'utf8'),coverage);
const inheritedCoverageResult=coverage.runAllTests();

const properties=new Map();
const events=new Map();
let inserted=0,patched=0,removed=0;
const booking=contextFor('booking-sync',{
  PropertiesService:{getScriptProperties:()=>({getProperties:()=>Object.fromEntries(properties),setProperty:(k,v)=>properties.set(k,v),deleteProperty:k=>properties.delete(k)})},
  Calendar:{Events:{
    list:(calendar,options)=>{assert.equal(calendar,'test-calendar');return{items:[...events.values()].filter(e=>'reservationId='+e.extendedProperties.private.reservationId===options.privateExtendedProperty)};},
    insert:(resource,calendar)=>{assert.equal(calendar,'test-calendar');const id='event-'+(++inserted);events.set(id,{...resource,id,created:new Date().toISOString()});return{id};},
    patch:(resource,calendar,id)=>{assert.equal(calendar,'test-calendar');assert.ok(events.has(id));events.set(id,{...events.get(id),...resource});patched++;},
    remove:(calendar,id)=>{assert.equal(calendar,'test-calendar');assert.ok(events.has(id));events.delete(id);removed++;}
  }}
});
const cases=[];
function test(name,fn){fn();cases.push(name);}

test('booking sync and trigger installation are disabled by default',()=>{
  assert.throws(()=>booking.syncReservations(),/disabled/);
  assert.throws(()=>booking.setupTrigger(),/disabled/);
});
test('Vrbo cross-year reservation preserves both years',()=>{
  const b=booking.parseVrboMessage_('Reservation from alex guest: Dec 30, 2026 - Jan 2, 2027 - Vrbo #EXAMPLE','Reservation ID HA-DEMO001',new Date('2026-11-01'));
  assert.equal(b.guestName,'Alex Guest');assert.equal(b.checkIn.getFullYear(),2026);assert.equal(b.checkOut.getFullYear(),2027);
});
test('Vrbo reservation request is not a confirmed stay',()=>assert.equal(booking.parseVrboMessage_('Reservation request from Alex','Reservation ID HA-DEMO001',new Date()),null));
test('Airbnb explicit stay years override email year',()=>{
  const body='New booking confirmed!\n\nAlex Guest\nCONFIRMATION CODE\nHMDEMO001\nCheck-in Fri, May 15, 2027 4:00 PM Checkout Mon, May 18, 2027 11:00 AM';
  const b=booking.parseAirbnbMessage_('New booking confirmed! Alex arrives May 15.',body,new Date('2026-12-01'));
  assert.equal(b.reservationId,'HMDEMO001');assert.equal(b.checkIn.getFullYear(),2027);assert.equal(b.guestName,'Alex Guest');
});
test('Airbnb cancellation prefers the subject reservation',()=>{
  const b=booking.parseAirbnbMessage_('Canceled: Reservation HMDEMO001 for Jun 15 - 18, 2027','CONFIRMATION CODE\nHMOTHER01',new Date());
  assert.equal(b.reservationId,'HMDEMO001');assert.equal(b.canceled,true);
});
test('cancellation policy notices do not delete reservations',()=>assert.equal(booking.parseAirbnbMessage_('Cancellation policy update','CONFIRMATION CODE\nHMDEMO001',new Date()),null));
test('missing stay dates and night count are not guessed',()=>assert.equal(booking.parseAirbnbMessage_('New booking confirmed! Alex arrives Jun 15.','CONFIRMATION CODE\nHMDEMO001',new Date('2027-01-01')),null));

vm.runInContext("CONFIG.ENABLED=true; CONFIG.CALENDAR_ID='test-calendar';",booking);
const example={source:'Airbnb',reservationId:'HMDEMO001',guestName:'Alex Guest',checkIn:new Date('2027-06-15T16:00:00'),checkOut:new Date('2027-06-18T11:00:00'),canceled:false};
let confirmed=[example],canceled=[];
booking.collectBookingsFromGmail_=()=>({confirmed,canceled});
test('a second sync does not create a duplicate',()=>{booking.syncReservations();booking.syncReservations();assert.equal(inserted,1);assert.equal(patched,0);assert.equal(events.size,1);});
test('a changed stay patches the same event and preserves manual notes',()=>{
  events.get('event-1').description='Keep this manual note';
  confirmed=[{...example,checkOut:new Date('2027-06-19T11:00:00')}];booking.syncReservations();
  assert.equal(inserted,1);assert.equal(patched,1);assert.equal(events.get('event-1').description,'Keep this manual note');
});
test('cancellation removes its event and mapping',()=>{
  confirmed=[];canceled=['HMDEMO001'];booking.syncReservations();assert.equal(removed,1);assert.equal(events.size,0);assert.equal(properties.has('res_HMDEMO001'),false);
});
console.log(JSON.stringify({coverage:inheritedCoverageResult,disabledCoverageGuard:'pass',bookingCases:cases.length,bookingResults:cases,externalServiceCalls:0},null,2));
