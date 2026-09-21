const HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"public,max-age=21600"};
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
const normalize=(source)=>{const items=[];collect(source,items);const cities={};for(const item of items){const label=item.address&&item.address!==item.city?`${item.name} - ${item.address}`:item.name;(cities[item.city]??=[]).push(label)}for(const key of Object.keys(cities))cities[key]=[...new Set(cities[key])].sort((a,b)=>a.localeCompare(b,'lv'));return {updatedAt:new Date().toISOString(),count:items.length,cities}};

const rateBuckets = globalThis.__sbOmnivaRateBuckets ??= new Map();
const getClientKey = (req) => (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0,120);
const rateLimit = (req, limit=20, windowMs=60_000) => {
  const now = Date.now(); const key = getClientKey(req); const hit = rateBuckets.get(key);
  if (!hit || now-hit.started>=windowMs) { rateBuckets.set(key,{started:now,count:1}); return null; }
  hit.count += 1; if(hit.count<=limit) return null;
  return json(429,{error:'Too many requests. Please try again shortly.',code:'RATE_LIMITED'},{'Retry-After':String(Math.max(1,Math.ceil((hit.started+windowMs-now)/1000)))});
};
const sameOrigin = (req) => { const origin=req.headers.get('origin'); return !origin || origin===new URL(req.url).origin; };
const first=(...v)=>v.find(x=>x!==undefined&&x!==null&&String(x).trim()!=="");
const town=o=>String(first(o.A2_NAME,o.A1_NAME,o.town,o.city,o.TOWN,o.CITY,o.county,o.parish)||"Latvija").trim();
const name=o=>String(first(o.NAME,o.name,o.NAME_LV,o.name_lv)||"").trim();
const address=o=>[first(o.A5_NAME,o.street,o.STREET),first(o.A7_NAME,o.house,o.HOUSE),first(o.A2_NAME,o.town,o.city,o.TOWN,o.CITY)].filter(Boolean).map(String).filter(Boolean).join(', ');
function collect(node,out){if(Array.isArray(node)){node.forEach(x=>collect(x,out));return}if(!node||typeof node!=='object')return;const country=String(first(node.A0_NAME,node.country,node.countryCode,node.COUNTRY_CODE)||'').toUpperCase();const type=String(first(node.TYPE,node.type,node.locationType)||'0').toLowerCase();const nm=name(node);if(country==='LV'&&(type==='0'||type==='parcelmachine')&&nm)out.push({name:nm,address:address(node),city:town(node)});Object.values(node).forEach(v=>{if(v&&typeof v==='object')collect(v,out)})}
export default async (req)=>{if(req.method!=='GET')return json(405,{error:'Only GET is allowed.'});if(!sameOrigin(req))return json(403,{error:'Cross-origin request blocked.',code:'ORIGIN_BLOCKED'});const limited=rateLimit(req);if(limited)return limited;try{const response=await fetch('https://www.omniva.ee/locations.json',{headers:{accept:'application/json'}});if(!response.ok)throw new Error(String(response.status));const source=await response.json();return json(200,normalize(source))}catch(error){console.error('Omniva locations error',error);try{const fallback=await fetch(new URL('/data/omniva-locations.json',req.url),{headers:{accept:'application/json'}});if(fallback.ok){const cached=await fallback.json();const cities={};for(const item of (cached.locations||[])){const label=item.address&&item.address!==item.city?`${item.name} - ${item.address}`:item.name;(cities[item.city]??=[]).push(label)}for(const key of Object.keys(cities))cities[key]=[...new Set(cities[key])].sort((a,b)=>a.localeCompare(b,'lv'));return json(200,{updatedAt:cached.updatedAt||new Date().toISOString(),count:(cached.locations||[]).length,cities});}}catch{}return json(502,{error:'Omniva lokāciju datni nevarēja ielādēt.'})}};
