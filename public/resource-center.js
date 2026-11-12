(() => {
  const val = id => Math.max(0, Number(document.getElementById(id)?.value || 0));
  const money = n => n.toLocaleString('en-US',{style:'currency',currency:'USD'});
  const set = (id, html) => { const el=document.getElementById(id); if(el) el.textContent=html; };
  function feed(){
    const birds=val('feed-birds'), per=val('feed-per'), days=val('feed-days'), bag=val('feed-bag'), price=val('feed-price');
    if(!birds||!per||!days||!bag){set('feed-result','Enter positive animal, feed, day, and bag values.');return;}
    const lbs=birds*per*days, bags=lbs/bag;
    set('feed-result',`Estimated feed: ${lbs.toFixed(1)} lb • ${bags.toFixed(2)} bags • Estimated cost: ${money(bags*price)} (before tax, delivery, or waste).`);
  }
  function fence(){
    const length=val('fence-length'), spacing=val('fence-spacing'), strands=val('fence-strands'), extra=val('fence-waste');
    if(!length||!spacing||!strands){set('fence-result','Enter positive length, spacing, and strand values.');return;}
    const intervals=Math.ceil(length/spacing), posts=intervals+1, wire=length*strands*(1+extra/100);
    set('fence-result',`Straight-run estimate: ${posts} line posts • ${wire.toFixed(0)} ft of wire including ${extra}% allowance. Excludes corner, gate, brace, and terrain-specific requirements.`);
  }
  function budget(){
    const total=['budget-land','budget-fence','budget-shelter','budget-stock','budget-other'].reduce((s,id)=>s+val(id),0);
    set('budget-result',`Estimated one-time startup total: ${money(total)}. This is only the sum of the amounts entered.`);
  }
  document.querySelectorAll('#feed-birds,#feed-per,#feed-days,#feed-bag,#feed-price').forEach(e=>e.addEventListener('input',feed));
  document.querySelectorAll('#fence-length,#fence-spacing,#fence-strands,#fence-waste').forEach(e=>e.addEventListener('input',fence));
  document.querySelectorAll('[id^="budget-"]').forEach(e=>e.addEventListener('input',budget));
  feed(); fence(); budget();
})();