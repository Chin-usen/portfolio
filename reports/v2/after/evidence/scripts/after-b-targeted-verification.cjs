const {chromium}=require('../../portfolio-main-v2/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const out=path.join(__dirname,'after-b-evidence'),base='http://127.0.0.1:4326';
const report={timestamp:new Date().toISOString(),engine:'Chromium',checks:[],limitations:['No physical device or assistive-technology speech output','Text-only 200% root-font scaling, not OS-level magnification']};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function ratio(a,b){const lin=c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4};const lum=c=>.2126*lin(c[0])+.7152*lin(c[1])+.0722*lin(c[2]);return (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);}
(async()=>{const browser=await chromium.launch({headless:true});report.browserVersion=browser.version();try{
for(const theme of ['light','dark'])for(const lang of ['zh','en']){
 const c=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme,reducedMotion:'reduce'}),p=await c.newPage();
 await p.goto(base+(lang==='en'?'/en':'')+'/lab/chip-junction-temperature/',{waitUntil:'networkidle'});
 await p.evaluate(()=>document.fonts.ready);
 const skip=p.locator('.skip-link');await skip.focus();
 const colors=async locator=>locator.evaluate(e=>{
   const color=s=>{const m=s.match(/[\d.]+/g).map(Number);return [m[0],m[1],m[2],m.length>3?m[3]:1]};
   const rgba=color(getComputedStyle(e).color);let bg=[255,255,255],layers=[],n=e;
   while(n){layers.unshift(color(getComputedStyle(n).backgroundColor));n=n.parentElement}
   for(const a of layers) bg=bg.map((v,i)=>a[i]*a[3]+v*(1-a[3]));
   const fg=bg.map((v,i)=>rgba[i]*rgba[3]+v*(1-rgba[3]));
   return {fg,bg,fontSize:getComputedStyle(e).fontSize,text:e.textContent.trim()};
 });
 const skipPair=await colors(skip);skipPair.ratio=ratio(skipPair.fg,skipPair.bg);
 await p.locator('[data-tab=amb]').click();const pill=p.locator('[data-material-value="24"]');await pill.click();await p.waitForTimeout(300);
 const pillPair=await colors(pill);pillPair.ratio=ratio(pillPair.fg,pillPair.bg);
 const secondaryPair=await colors(p.locator('.thermal-node-label'));secondaryPair.ratio=ratio(secondaryPair.fg,secondaryPair.bg);
 const op=p.locator('[data-tab=operating]');await op.focus();await p.keyboard.press('End');
 const tabVisibility=await p.locator('[data-tab=cooler]').evaluate(e=>{const r=e.getBoundingClientRect(),s=e.parentElement.getBoundingClientRect();return {selected:e.getAttribute('aria-selected'),left:r.left,right:r.right,stripLeft:s.left,stripRight:s.right,scrollLeft:e.parentElement.scrollLeft,fullyVisible:r.left>=s.left-1&&r.right<=s.right+1}});
 await op.click();const input=p.locator('[data-param=P]');await input.fill('500');await p.waitForTimeout(400);await input.scrollIntoViewIfNeeded();
 const sticky=await p.locator('[data-control-summary]').evaluate(e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight,visible:r.top>=0&&r.bottom<=innerHeight,text:e.textContent.trim(),duplicateAriaHidden:e.getAttribute('aria-hidden')}});
 const inputBox=await input.boundingBox();const inputNotObscured=inputBox.y>=sticky.bottom;
 const warning={visible:await p.locator('[data-control-warning]').isVisible(),liveText:await p.locator('[data-result-live]').innerText(),liveAttributes:await p.locator('[data-result-live]').evaluate(e=>({live:e.getAttribute('aria-live'),atomic:e.getAttribute('aria-atomic')}))};
 await p.screenshot({path:path.join(out,'b-sticky-'+lang+'-'+theme+'.png')});
 await p.locator('[data-model=fem]').click();await p.locator('[data-thermal-lab][data-model=fem]').waitFor();await p.waitForTimeout(400);
 const fem={summary:await p.locator('[data-control-summary]').innerText(),tj:await p.locator('[data-value=tj]').innerText(),model:await p.locator('[data-model-label]').innerText()};
 await p.addStyleTag({content:'html{font-size:200%!important}'});
 await input.scrollIntoViewIfNeeded();
 const enlarged=await p.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}};return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,metrics:box('.thermal-metrics'),actions:box('.thermal-view-actions'),canvas:box('.thermal-canvas'),scale:box('.thermal-scale'),summary:box('[data-control-summary]'),input:box('[data-param=P]')}});
 await p.screenshot({path:path.join(out,'b-sticky-text200-'+lang+'-'+theme+'.png')});
 report.checks.push({theme,lang,skipPair,pillPair,secondaryPair,tabVisibility,sticky,inputNotObscured,warning,fem,enlarged});
 await c.close();
}
fs.writeFileSync(path.join(out,'after-targeted-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

