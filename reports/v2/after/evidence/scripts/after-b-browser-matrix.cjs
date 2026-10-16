const { chromium } = require('../../portfolio-main-v2/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const out = require('node:path').join(__dirname, 'after-b-evidence');
const base = 'http://127.0.0.1:4326';
const routes = ['/', '/work/', '/lab/', '/about/', '/contact/', '/lab/chip-junction-temperature/'];
const report = {date:new Date().toISOString(),engine:'Chromium',source:'portfolio-main-v2 after fixes',matrix:[],interactions:[],errors:[]};
(async()=>{
 const browser = await chromium.launch({headless:true});
 report.browserVersion=browser.version();
 try {
 for (const width of [1440,390]) for (const theme of ['light','dark']) for (const language of ['zh','en']) {
   const context = await browser.newContext({viewport:{width,height:width===1440?1000:844},colorScheme:theme,reducedMotion:'reduce',deviceScaleFactor:1});
   const page = await context.newPage();
   for (const route of routes) {
     const url = (language==='en'?'/en':'')+route;
     const errors=[]; const onError=e=>errors.push(e.message); page.on('pageerror',onError);
     const response=await page.goto(base+url,{waitUntil:'networkidle'});
     await page.evaluate(()=>document.fonts.ready);
     if(route.includes('temperature')) await page.locator('[data-thermal-renderer]').waitFor();
     const metrics=await page.evaluate(()=>{
       const visible=e=>{let r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[hidden]')};
       const box=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
       const smallTargets=[...document.querySelectorAll('a,button,input,select,[role="tab"]')].filter(visible).filter(e=>{let r=e.getBoundingClientRect();return r.width<44||r.height<44}).map(e=>({tag:e.tagName,text:e.innerText||e.getAttribute('aria-label')||e.id,testid:e.getAttribute('data-testid'),class:e.className,box:box(e)}));
       const minText=[...document.querySelectorAll('p,span,dt,dd,label,button,small')].filter(visible).filter(e=>e.textContent.trim()&&parseFloat(getComputedStyle(e).fontSize)<11).map(e=>({text:e.textContent.trim().slice(0,100),size:getComputedStyle(e).fontSize,class:e.className}));
       return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,bodyColor:getComputedStyle(document.body).color,bodyBg:getComputedStyle(document.body).backgroundColor,colorScheme:getComputedStyle(document.documentElement).colorScheme,mainCount:document.querySelectorAll('main').length,h1Count:document.querySelectorAll('h1').length,lang:document.documentElement.lang,title:document.title,smallTargets,minText,rangeCount:document.querySelectorAll('input[type=range]').length,resources:performance.getEntriesByType('resource').map(r=>({name:r.name.split('/').pop(),type:r.initiatorType,transferSize:r.transferSize,decodedBodySize:r.decodedBodySize,duration:r.duration})),themeTokens:{secondary:getComputedStyle(document.documentElement).getPropertyValue('--thermal-secondary'),card:getComputedStyle(document.documentElement).getPropertyValue('--thermal-card')},hiddenActiveNav:[...document.querySelectorAll('nav [aria-current]')].map(e=>e.textContent.trim()),headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>({level:e.tagName,text:e.textContent.trim()}))};
     });
     const slug=url.replaceAll('/','_')||'home';
     const screenshot=`b-${language}-${route.includes('temperature')?'s1':route==='/'?'home':route.split('/')[1]}-${width}-${theme}.png`;
     await page.screenshot({path:path.join(out,screenshot),fullPage:true});
     report.matrix.push({route:url,width,theme,status:response.status(),screenshot,metrics,errors});
     page.removeListener('pageerror',onError);
   }
   await context.close();
 }
 fs.writeFileSync(path.join(out,'after-browser-matrix.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({views:report.matrix.length,overflow:report.matrix.filter(x=>x.metrics.scrollWidth>x.width+1).map(x=>x.route),errors:report.matrix.flatMap(x=>x.errors),themeSamples:report.matrix.filter(x=>x.width===390&&['/','/lab/chip-junction-temperature/'].includes(x.route)).map(x=>({route:x.route,theme:x.theme,bg:x.metrics.bodyBg,color:x.metrics.bodyColor}))}));
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

