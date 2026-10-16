const {chromium}=require('../../portfolio-main-v2/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const out=path.join(__dirname,'after-b-evidence'),base='http://127.0.0.1:4326';
const report={timestamp:new Date().toISOString(),source:'final standalone target closure',checks:[]};
(async()=>{const browser=await chromium.launch({headless:true});try{
for(const lang of ['zh','en'])for(const width of [390,1440]){
 const c=await browser.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce',colorScheme:'light'}),p=await c.newPage();
 for(const route of ['/','/work/','/lab/','/about/','/contact/']){
  await p.goto(base+(lang==='en'?'/en':'')+route,{waitUntil:'load'});await p.evaluate(()=>document.fonts.ready);
  const targets=await p.locator('.content-card h2 a,.content-card h3 a,.meta-list a').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent.trim(),width:r.width,height:r.height,pass:r.width>=44&&r.height>=44}}));
  const widthState=await p.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  report.checks.push({lang,width,route,targets,widthState});
  if(lang==='en'&&width===390&&(route==='/'||route==='/contact/'))await p.screenshot({path:path.join(out,'b-final-targets-'+(route==='/'?'home':'contact')+'-en-390.png'),fullPage:true});
 }
 await c.close();
}
fs.writeFileSync(path.join(out,'after-final-targets.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({states:report.checks.length,targets:report.checks.flatMap(s=>s.targets).length,failed:report.checks.filter(s=>s.targets.some(t=>!t.pass)),overflow:report.checks.filter(s=>s.widthState.document>s.widthState.viewport+1)}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

