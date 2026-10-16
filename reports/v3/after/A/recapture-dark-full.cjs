const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {chromium}=require('../../portfolio-main-v3/node_modules/@playwright/test');
(async()=>{const browser=await chromium.launch({headless:true});const rows=[];
try{for(const surface of ['home','s1'])for(const locale of ['zh','en'])for(const width of [1440,390])for(const theme of (surface==='home'?['dark']:['light','dark'])){
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,deviceScaleFactor:1});const page=await context.newPage();
 const url=(locale==='zh'?'':'/en')+(surface==='home'?'/':'/lab/chip-junction-temperature/');
 await page.goto('http://127.0.0.1:4337'+url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 if(surface==='s1'){await page.locator('.thermal-canvas[data-thermal-canvas]').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!!document.querySelector('.thermal-canvas[data-thermal-canvas]')?.dataset.thermalRenderer);}
 await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(300);
 const measure=()=>page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,sections:[...document.querySelectorAll('.home-hero,.home-module,.home-metrics,.home-lab,.thermal-heading,.thermal-metrics,.thermal-stage,.thermal-parameters,.thermal-model-notes,.site-footer')].map(el=>{const r=el.getBoundingClientRect();return {name:el.className,x:r.x,y:r.y+scrollY,w:r.width,h:r.height};})}));
 const before=await measure();await page.setViewportSize({width,height:before.height});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(500);const after=await measure();
 if(JSON.stringify(before.sections)!==JSON.stringify(after.sections)||before.height!==after.height||before.width!==after.width)throw Error('Capture viewport changed page geometry');
 const name=`${surface}-${locale}-${width}-${theme}.png`;const priorSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,name))).digest('hex');await page.screenshot({path:path.join(__dirname,name),fullPage:false});
 rows.push({name,priorSha256,method:'Viewport expanded to full document height after verifying identical section geometry; no image compositing or CSS changes.',originalViewport:{width,height:900},captureViewport:{width,height:before.height},before,after,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,name))).digest('hex')});
 await context.close();console.log('Recaptured '+name);
}}finally{await browser.close();}
const record={time:new Date().toISOString(),browserClosed:true,rows};fs.writeFileSync(path.join(__dirname,'final-fullpage-capture.json'),JSON.stringify(record,null,2));
const gp=path.join(__dirname,'followup-observed-geometry.json'),g=JSON.parse(fs.readFileSync(gp));g.finalSourceHashes=Object.fromEntries(Object.keys(g.sourceHashes).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../portfolio-main-v3',f))).digest('hex')]));g.captureCorrection='Four dark Home and eight S1 PNGs use geometry-verified full-document viewport capture at scroll0; see final-fullpage-capture.json';for(const r of rows)g.screenshotHashes[r.name]=r.sha256;fs.writeFileSync(gp,JSON.stringify(g,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
