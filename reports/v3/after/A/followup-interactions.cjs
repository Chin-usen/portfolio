// Focused A1/A2/sticky-summary follow-up, no source mutations.
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('../../portfolio-main-v3/node_modules/@playwright/test');
const out=__dirname,base='http://127.0.0.1:4337';
const snapshot=async page=>page.evaluate(()=>{
 const box=el=>{if(!el)return null;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,position:s.position,visible:!!el.getClientRects().length&&s.visibility!=='hidden'};};
 const summary=document.querySelector('[data-control-summary]'),tabs=document.querySelector('[role=tablist]'),panel=document.querySelector('[data-panel=operating]');
 const stage=document.querySelector('.thermal-stage');
 return {scrollY,viewport:{w:innerWidth,h:innerHeight},scrollWidth:document.documentElement.scrollWidth,selectedTab:document.querySelector('[data-tab][aria-selected=true]')?.textContent.trim(),activeElement:{tag:document.activeElement?.tagName,id:document.activeElement?.id,param:document.activeElement?.getAttribute('data-param')},summary:box(summary),tabs:box(tabs),operatingPanel:box(panel),h:box(document.querySelector('[data-param=h]')),layerCard:box(document.querySelector('[data-layer-card]')),stageText:stage?.innerText,stageCopy:[...stage.querySelectorAll('p,small,figcaption')].map(el=>({class:el.className,attrs:[...el.attributes].map(a=>[a.name,a.value]),...box(el)})),numericInputs:document.querySelectorAll('input[type=number]').length,order:{tabsBeforeSummary:!!(tabs.compareDocumentPosition(summary)&Node.DOCUMENT_POSITION_FOLLOWING),summaryBeforePanel:!!(summary.compareDocumentPosition(panel)&Node.DOCUMENT_POSITION_FOLLOWING)}};
});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const states=[];
 try{
  for(const locale of ['zh','en'])for(const width of [1440,390])for(const text of [100,200]){
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:'light',deviceScaleFactor:1});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const name=`followup-s1-${locale}-${width}-text${text}`;
   await page.goto(base+(locale==='en'?'/en':'')+'/lab/chip-junction-temperature/',{waitUntil:'networkidle'});
   await page.evaluate(()=>document.fonts.ready);
   if(text===200)await page.evaluate(()=>document.documentElement.style.fontSize='200%');
   await page.locator('.thermal-canvas[data-thermal-canvas]').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>!!document.querySelector('[data-thermal-canvas]')?.getAttribute('data-thermal-renderer'));
   await page.waitForTimeout(500);
   const result={name,locale,width,text,errors};
   result.analytic=await snapshot(page);
   await page.locator('.thermal-stage').screenshot({path:path.join(out,name+'-analytic-field.png')});
   await page.locator('[data-model=fem]').click();
   await page.waitForFunction(()=>document.querySelector('[data-thermal-lab]').dataset.model==='fem');
   await page.waitForTimeout(350);
   result.fem=await snapshot(page);
   await page.locator('.thermal-stage').screenshot({path:path.join(out,name+'-fem-field.png')});
   await page.locator('[data-model=analytic]').click();
   await page.locator('[data-select-layer=cooler]').click();
   result.coolerVisibleBefore=await page.locator('[data-layer-card]').isVisible();
   await page.locator('[data-select-layer=convection]').click();
   result.convection=await snapshot(page);
   await page.screenshot({path:path.join(out,name+'-convection.png')});
   const tabHits=[];
   for(const tab of await page.locator('[data-tab]').all()){
    await tab.scrollIntoViewIfNeeded();
    const hit=await tab.evaluate(el=>{const r=el.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:el.id,covered:!(top===el||el.contains(top)),covering:top?.className};});
    await tab.click();
    tabHits.push({...hit,selected:await tab.getAttribute('aria-selected')});
   }
   result.tabHits=tabHits;
   await page.locator('#thermal-tab-operating').click();
   await page.locator('[data-param=P]').press('End');
   await page.waitForTimeout(300);
   result.highPower=await snapshot(page);
   await page.locator('.thermal-parameters').screenshot({path:path.join(out,name+'-parameters.png')});
   await page.locator('[data-param=h]').scrollIntoViewIfNeeded();
   await page.waitForTimeout(250);
   result.scrolledToH=await snapshot(page);
   await page.screenshot({path:path.join(out,name+'-sticky-h.png')});
   await page.locator('[data-reset-params]').click();
   await page.waitForFunction(()=>document.querySelector('[data-control-tj]')?.textContent==='125.6');
   result.reset=await snapshot(page);
   await page.keyboard.press('Control+Home');
   await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
   if(width===390&&text===200)await page.screenshot({path:path.join(out,`s1-${locale}-390-text200.png`),fullPage:true});
   states.push(result);await context.close();console.log('Checked '+name);
  }
  // Refresh the prior Home 200% evidence on the same final build.
  for(const locale of ['zh','en']){
   const context=await browser.newContext({viewport:{width:390,height:900},colorScheme:'light'});const page=await context.newPage();
   await page.goto(base+(locale==='en'?'/en/':'/'),{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(()=>document.documentElement.style.fontSize='200%');
   await page.locator('.home-lab').scrollIntoViewIfNeeded();await page.waitForTimeout(400);
   await page.locator('.home-metrics').scrollIntoViewIfNeeded();await page.waitForTimeout(200);
   const name=`home-${locale}-390-text200`;
   const geometry=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
   await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});states.push({name,...geometry});await context.close();
  }
  fs.writeFileSync(path.join(out,'followup-interaction-evidence.json'),JSON.stringify({time:new Date().toISOString(),browser:browser.version(),states},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
