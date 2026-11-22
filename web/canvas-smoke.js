// Optional browser QA. Executes ONLY when explicitly injected on ?__canvas_qa=1.
// It uses a fresh Browser Rendering session, not a customer's real canvas.
(() => {
 if(new URLSearchParams(location.search).get('__canvas_qa')!=='1')return;
 let retries=0;
 const run=()=>{
  if(!document.querySelector('#boardNodes .board-note')){
   if(retries++<50)setTimeout(run,100);
   return;
  }
  const result={};
  try{
   const count=()=>document.querySelectorAll('#boardNodes .board-note').length;
   const start=count();
   document.querySelector('#boardAdd').click();
   result.create=count()===start+1&&!document.querySelector('#boardPanel').hidden;
   const title=document.querySelector('#boardEditTitle');
   const body=document.querySelector('#boardEditBody');
   title.value='Canvas QA note';body.value='Editable free text';
   document.querySelector('#boardEditForm').requestSubmit();
   result.edit=[...document.querySelectorAll('.board-note-title')].some(n=>n.textContent==='Canvas QA note');
   const afterCreate=count();
   document.querySelector('#boardUndo').click();
   result.undo=count()===afterCreate&&[...document.querySelectorAll('.board-note-title')].some(n=>n.textContent==='New thought');
   document.querySelector('#boardRedo').click();
   result.redo=count()===afterCreate&&[...document.querySelectorAll('.board-note-title')].some(n=>n.textContent==='Canvas QA note');
   document.querySelector('.board-note.root .board-note-plus').click();
   result.child=count()===afterCreate+1&&document.querySelectorAll('.board-edge').length>=1;
   document.querySelector('#boardAi').click();
   result.optionalAI=document.querySelector('#boardAi').getAttribute('aria-expanded')==='true'&&!document.querySelector('#boardAiPanel').hidden;
   document.querySelector('#boardAiClose').click();
   result.closeAI=document.querySelector('#boardAiPanel').hidden;
   const local=JSON.parse(localStorage.getItem('thenvio-ideas-portfolio-v1'));
   result.saved=local?.graphs?.some(g=>g.nodes?.length>=afterCreate+1);
  }catch(e){result.error=e.message;}
  result.ok=Object.entries(result).every(([name,v])=>name==='ok'||v===true);
  document.title='Canvas QA '+(result.ok?'PASS':'FAIL');
  document.body.dataset.canvasQa=JSON.stringify(result);
  const marker=document.createElement('div');
  marker.id='boardSmokeResult';marker.textContent='Canvas QA '+(result.ok?'PASS':'FAIL')+': '+JSON.stringify(result);
  marker.setAttribute('role','status');
  marker.style.cssText='position:fixed;bottom:80px;right:12px;z-index:9999;background:#fff;color:#111;padding:12px;border:1px solid #bbb;font:12px monospace;max-width:350px';
  document.body.append(marker);
 };
 setTimeout(run,250);
})();
