const { chromium } = require('../../portfolio-p3/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
 const out = path.join(__dirname, 'assessment-a-evidence'); fs.mkdirSync(out, {recursive: true});
 const browser = await chromium.launch({headless:true});
 const results=[];
 for (const width of [1440,390]) for(const colorScheme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},colorScheme,reducedMotion:'reduce'});
  const page=await context.newPage();
  for(const locale of ['zh','en']) for(const [name,route] of [['home','/'],['work','/work/'],['lab','/lab/'],['about','/about/'],['contact','/contact/'],['s1','/lab/chip-junction-temperature/']]) {
   const url='http://127.0.0.1:4325'+(locale==='en'?'/en':'')+route;
   await page.goto(url); await page.evaluate(()=>document.fonts.ready);
   if(name==='s1') await page.locator('[data-thermal-canvas] canvas, [data-thermal-canvas] > svg').waitFor({timeout:15000});
   const id=[locale,name,width,colorScheme].join('-');
   await page.screenshot({path:path.join(out,id+'.png'),fullPage:true});
   const state=await page.evaluate(()=>({
    title:document.title, background:getComputedStyle(document.body).backgroundColor,font:getComputedStyle(document.body).fontFamily,
    pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,pageHeight:document.documentElement.scrollHeight,
    headings:[...document.querySelectorAll('h1,h2,h3')].map(x=>({tag:x.tagName,text:x.innerText})),
    controls:[...document.querySelectorAll('a,button,input')].filter(x=>x.getBoundingClientRect().width && x.getBoundingClientRect().height).map(x=>{const b=x.getBoundingClientRect();return {tag:x.tagName,text:(x.innerText||x.getAttribute('aria-label')||x.id).trim(),width:b.width,height:b.height,top:b.top};})
   })); results.push({id,url,...state});
  }
  await context.close();
 }
 fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify(results,null,2));
 await browser.close(); console.log(JSON.stringify({captures:results.length,out}));
})().catch(error=>{console.error(error);process.exit(1)});