// Final A follow-up capture. Original capture/report/evidence are in pre-followup/.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('../../portfolio-main-v3/node_modules/@playwright/test');
const out = __dirname;
const base = 'http://127.0.0.1:4337';
const targets = ['src/components/HomePage.astro','src/styles/home.css','src/components/lab/thermal-stack/ThermalStack.astro','src/components/lab/thermal-stack/thermal.css','src/components/lab/thermal-stack/client.ts','src/components/Header.astro'];
const routes = [{name:'home-zh',url:'/'},{name:'home-en',url:'/en/'},{name:'s1-zh',url:'/lab/chip-junction-temperature/'},{name:'s1-en',url:'/en/lab/chip-junction-temperature/'}];
(async () => {
 const browser = await chromium.launch({headless:true});
 const states = [];
 try {
  for (const route of routes) for (const width of [1440,390]) for (const theme of ['light','dark']) {
   const context = await browser.newContext({viewport:{width,height:900},colorScheme:theme,deviceScaleFactor:1});
   const page = await context.newPage();
   const errors = [];
   page.on('pageerror', e => errors.push(e.message));
   const name = `${route.name}-${width}-${theme}`;
   await page.goto(base+route.url,{waitUntil:'networkidle'});
   await page.evaluate(() => document.fonts.ready);
   if (route.name.startsWith('s1')) {
    await page.locator('.thermal-canvas[data-thermal-canvas]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !!document.querySelector('[data-thermal-canvas]')?.getAttribute('data-thermal-renderer'),{timeout:15000});
   } else await page.waitForFunction(() => document.querySelector('home-thermal-preview')?.getAttribute('data-enhanced') === 'true');
   await page.keyboard.press('Control+Home');
   await page.waitForTimeout(700);
   await page.screenshot({path:path.join(out,name+'-top.png')});
   const sections = route.name.startsWith('s1') ? {parameters:'.thermal-parameters',model:'.thermal-stage',notes:'.thermal-model-notes'} : {lab:'.home-lab',career:'.home-metrics'};
   for (const [key, selector] of Object.entries(sections)) await page.locator(selector).screenshot({path:path.join(out,name+'-'+key+'.png')});
   await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
   states.push(await page.evaluate(({name,errors}) => {
    const probe = selector => {
     const el=document.querySelector(selector); if(!el) return null;
     const s=getComputedStyle(el), r=el.getBoundingClientRect();
     return {text:el.textContent.trim().slice(0,600),x:r.x,y:r.y+scrollY,width:r.width,height:r.height,font:s.fontSize,fontFamily:s.fontFamily,color:s.color,background:s.backgroundColor,radius:s.borderRadius,display:s.display,position:s.position,grid:s.gridTemplateColumns};
    };
    const controls=[...document.querySelectorAll('a,button,input')].filter(el=>{const s=getComputedStyle(el);return el.getClientRects().length && s.visibility!=='hidden';}).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,id:el.id,text:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,100),width:r.width,height:r.height,disabled:el.disabled||false};});
    return {name,title:document.title,url:location.href,viewport:{w:innerWidth,h:innerHeight},scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,header:probe('.site-header'),h1:probe('h1'),workspace:probe('.thermal-workspace'),metrics:probe('.thermal-metrics'),stage:probe('.thermal-stage'),parameters:probe('.thermal-parameters'),summary:probe('.thermal-control-summary'),tablist:probe('[role=tablist]'),metric:probe('.thermal-temperature'),renderer:document.querySelector('[data-thermal-canvas]')?.getAttribute('data-thermal-renderer'),visibleControls:controls,errors};
   },{name,errors}));
   await context.close();
   console.log('Captured final '+name);
  }
  const sourceHashes=Object.fromEntries(targets.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../portfolio-main-v3',f))).digest('hex')]));
  const screenshotHashes=Object.fromEntries(states.map(({name})=>{const f=name+'.png';return [f,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]}));
  fs.writeFileSync(path.join(out,'followup-observed-geometry.json'),JSON.stringify({time:new Date().toISOString(),browser:browser.version(),base,sourceHashes,screenshotHashes,states},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
