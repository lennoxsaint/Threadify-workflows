// Optional browser verification. Supply PLAYWRIGHT_MODULE pointing at a local Playwright index.mjs.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { demo } from '../../examples/inbound-synthetic/demo.mjs';
import { serve } from './server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = fs.mkdtempSync(path.join(os.tmpdir(),'inbound-ui-'));
const store=demo(root,120), {server,url}=await serve(store,'@example');
const browser=await chromium.launch({headless:true});
const output=process.env.INBOUND_QA_OUTPUT || path.join(os.tmpdir(),'inbound-qa');fs.mkdirSync(output,{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url);await page.locator('textarea').first().waitFor();assert.equal(await page.locator('textarea').count(),5);
 const edited='A precise edit.\n\nUnicode: café 🌿  ';
 await page.locator('textarea').first().fill(edited);await page.getByRole('button',{name:'Approve',exact:true}).first().click();await page.getByRole('button',{name:'Approved',exact:true}).waitFor();
 assert.equal(store.status('@example').items[0].final_text,edited);assert.equal(store.status('@example').items[0].state,'approved');
 await page.locator('textarea').first().fill(edited+'!');await page.getByRole('button',{name:'Approve',exact:true}).first().click();await page.getByRole('button',{name:'Approved',exact:true}).waitFor();
 await page.reload();await page.locator('textarea').first().waitFor();assert.equal(await page.locator('textarea').first().inputValue(),edited+'!');
 await page.getByRole('button',{name:'Next round'}).click();assert.equal(await page.locator('textarea').count(),5);assert.match(await page.locator('.post-body').first().innerText(),/planted herbs/);
 await page.getByRole('button',{name:'Previous round'}).click();
 await page.locator('#mode').selectOption('all');await page.waitForFunction(()=>document.querySelectorAll('textarea').length===50);await page.getByRole('button',{name:'Show more comments'}).click();await page.getByRole('button',{name:'Show more comments'}).click();assert.equal(await page.locator('textarea').count(),120);
 await page.locator('#mode').selectOption('five');await page.waitForFunction(()=>document.querySelectorAll('textarea').length===5);
 // Render untrusted text as inert content, even when persisted by the adapter.
 store.transaction('@example',s=>{s.items[s.batches[s.active].ids[0]].text='<img src=x onerror="window.injected=true"><script>window.injected=true</script>';});
 await page.getByRole('button',{name:'Refresh saved replies'}).click();await page.waitForFunction(()=>document.querySelector('.verbatim').textContent.includes('<img'));
 assert.equal(await page.evaluate(()=>window.injected),undefined);assert.equal(await page.locator('.comment img,.comment script').count(),0);
 await page.screenshot({path:path.join(output,'untrusted-content.png'),fullPage:true});
 store.transaction('@example',s=>{s.items[s.batches[s.active].ids[0]].text='What herbs would you try next?';});
 await page.getByRole('button',{name:'Refresh saved replies'}).click();await page.waitForFunction(()=>document.querySelector('.verbatim').textContent==='What herbs would you try next?');
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'BODY');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,cards:120,desktop:'1280x1000',mobile:'390x844',console_errors:errors,output}));
} finally {await browser.close();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
