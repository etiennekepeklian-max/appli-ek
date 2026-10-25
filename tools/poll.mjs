// Await the value of asynchronous browser predicates before deciding to proceed.
export async function waitForState(page,predicate,arg,timeout=15000){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  if(await page.evaluate(predicate,arg))return;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 throw Error('L’état attendu n’a pas été atteint : '+String(predicate).slice(0,180));
}
