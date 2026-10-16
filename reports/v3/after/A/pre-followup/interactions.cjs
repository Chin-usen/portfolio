const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../portfolio-main-v3/node_modules/@playwright/test');
const out=__dirname,base='http://127.0.0.1:4337';
(async()=>{
 const browser=await chromium.launch({headless:true}); const results={};
 try {
 const context=await browser.newContext({viewport:{width:390,height:900},colorScheme:'light'}); const page=await context.newPage();
 await page.goto(base+'/',{waitUntil:'networkidle'}); await page.evaluate(()=>document.fonts.ready);
 await page.locator('#home-ceramic-thickness').waitFor({state:'visible'});
 const tj=()=>page.locator('[data-home-tj]').innerText(); results.homeBefore=await tj();
 await page.locator('#home-ceramic-thickness').press('End'); await page.waitForTimeout(400);
 results.homeAfter={tj:await tj(),value:await page.locator('#home-ceramic-thickness').inputValue(),announcement:await page.locator('[data-home-announcement]').innerText()};
 await page.locator('.home-simulation-card').screenshot({path:path.join(out,'home-interaction.png')});
 await page.locator('.menu-toggle').click(); results.menuOpen={expanded:await page.locator('.menu-toggle').getAttribute('aria-expanded'),languageVisible:await page.locator('[data-testid=language-switch]').isVisible()};
 await page.locator('.menu-toggle').press('Escape'); results.menuEsc={expanded:await page.locator('.menu-toggle').getAttribute('aria-expanded'),focused:await page.evaluate(()=>document.activeElement.className)};
 await page.goto(base+'/en/lab/chip-junction-temperature/',{waitUntil:'networkidle'});
 await page.locator('[data-param=P]').press('End'); await page.waitForTimeout(400);
 results.highPower={value:await page.locator('[data-param=P]').inputValue(),tj:await page.locator('[data-value=tj]').innerText(),warning:await page.locator('[data-warning]').innerText(),warningVisible:await page.locator('[data-warning]').isVisible(),summary:await page.locator('[data-control-summary]').innerText()};
 await page.locator('.thermal-parameters').screenshot({path:path.join(out,'s1-mobile-high-power.png')});
 await page.locator('[data-reset-params]').click(); await page.waitForTimeout(400);
 results.reset={power:await page.locator('[data-param=P]').inputValue(),tj:await page.locator('[data-value=tj]').innerText(),warningVisible:await page.locator('[data-warning]').isVisible()};
 await page.locator('#thermal-tab-operating').press('ArrowRight'); results.keyboardTab={active:await page.evaluate(()=>document.activeElement.id),panel:await page.locator('[data-panel=top-solder]').isVisible()};
 await page.locator('[data-select-layer=ceramic]').click(); results.ceramic={card:await page.locator('[data-layer-card]').innerText(),tab:await page.locator('#thermal-tab-amb').getAttribute('aria-selected')};
 await page.locator('[data-material-value="170"]').click(); await page.waitForTimeout(400);
 results.material={k:await page.locator('[data-param=k_cer]').inputValue(),tj:await page.locator('[data-value=tj]').innerText()};
 await page.locator('[data-model=fem]').click(); await page.waitForFunction(()=>document.querySelector('[data-thermal-lab]').dataset.model==='fem'); await page.waitForTimeout(400);
 results.fem={tj:await page.locator('[data-value=tj]').innerText(),label:await page.locator('[data-model-label]').innerText(),validation:await page.locator('[data-validation]').innerText()};
 await page.locator('[data-model=analytic]').click(); await page.locator('[data-reset-params]').click();
 await page.locator('[data-select-layer=convection]').click(); results.convection={card:await page.locator('[data-layer-card]').innerText(),tab:await page.locator('[data-tab][aria-selected=true]').innerText()};
 await page.locator('.thermal-stage').screenshot({path:path.join(out,'s1-convection-selection.png')});
 await page.locator('[data-reset-view]').click(); results.resetView={cardHidden:!await page.locator('[data-layer-card]').isVisible()};
 const focus=[]; await page.goto(base+'/en/',{waitUntil:'networkidle'});
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');focus.push(await page.evaluate(()=>({tag:document.activeElement.tagName,text:(document.activeElement.getAttribute('aria-label')||document.activeElement.textContent).trim(),outline:getComputedStyle(document.activeElement).outlineStyle})));} results.keyboardHome=focus;
 results.text200=[];
 for(const route of [{n:'home-zh',url:'/'},{n:'home-en',url:'/en/'},{n:'s1-zh',url:'/lab/chip-junction-temperature/'},{n:'s1-en',url:'/en/lab/chip-junction-temperature/'}]) {
  await page.goto(base+route.url,{waitUntil:'networkidle'}); await page.evaluate(()=>document.fonts.ready); await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  if(route.n.startsWith('s1')) await page.locator('.thermal-canvas').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  results.text200.push(await page.evaluate(n=>({name:n,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,h1:getComputedStyle(document.querySelector('h1')).fontSize,overflows:[...document.querySelectorAll('main *')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map(el=>({tag:el.tagName,class:el.className,x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right,text:el.textContent.trim().slice(0,65)})).filter(x=>x.x < -1||x.right>innerWidth+1).slice(0,12)}),route.n));
  await page.screenshot({path:path.join(out,route.n+'-390-text200.png'),fullPage:true});
 }
 await context.close();
 fs.writeFileSync(path.join(out,'interaction-evidence.json'),JSON.stringify(results,null,2)); console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
