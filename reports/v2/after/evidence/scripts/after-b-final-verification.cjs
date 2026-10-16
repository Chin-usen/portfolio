const {chromium}=require('../../portfolio-main-v2/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const out=path.join(__dirname,'after-b-evidence'),base='http://127.0.0.1:4326';
const reports={timestamp:new Date().toISOString(),source:'final rebuilt after numeric grouping and standalone target fixes',checks:[]};
(async()=>{const browser=await chromium.launch({headless:true});try{
for(const lang of ['zh','en'])for(const width of [1440,390]){
const c=await browser.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce',colorScheme:'light'}),p=await c.newPage();
await p.goto(base+(lang==='en'?'/en':'')+'/lab/chip-junction-temperature/',{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);await p.locator('[data-thermal-renderer]').waitFor();
await p.locator('[data-param=P]').fill('500');await p.waitForTimeout(400);await p.locator('[data-param=P]').scrollIntoViewIfNeeded();
const desktopSummary=await p.locator('[data-control-summary]').evaluate(e=>{let r=e.getBoundingClientRect();return{display:getComputedStyle(e).display,top:r.top,bottom:r.bottom,height:r.height,text:e.textContent.trim(),viewport:innerHeight,visible:r.top>=0&&r.bottom<=innerHeight}});
await p.screenshot({path:path.join(out,'b-final-summary-'+lang+'-'+width+'.png')});
await p.locator('[data-reset-params]').click();await p.addStyleTag({content:'html{font-size:200%!important}'});await p.waitForTimeout(250);
const numericWrapping=await p.locator('[data-value=tj],[data-param-output=T_cool],[data-param-output=h]').evaluateAll(els=>els.map(e=>{
 const range=document.createRange(),topLines=[];for(let i=0;i<e.firstChild.textContent.length;i++){range.setStart(e.firstChild,i);range.setEnd(e.firstChild,i+1);const r=range.getBoundingClientRect();topLines.push(Math.round(r.top));}
 const r=e.getBoundingClientRect();return{selector:e.hasAttribute('data-value')?'data-value=tj':'data-param-output='+e.dataset.paramOutput,text:e.textContent,lines:[...new Set(topLines)].length,width:r.width,height:r.height,whiteSpace:getComputedStyle(e).whiteSpace,flexShrink:getComputedStyle(e).flexShrink};
}));
await p.locator('[data-param=T_cool]').scrollIntoViewIfNeeded();
await p.screenshot({path:path.join(out,'b-final-numeric-text200-'+lang+'-'+width+'.png')});
reports.checks.push({lang,width,desktopSummary,numericWrapping});await c.close();
}
fs.writeFileSync(path.join(out,'after-final-verification.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});


