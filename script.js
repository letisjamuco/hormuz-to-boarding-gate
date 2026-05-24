/* HORMUZ UNDER PRESSURE — script.js v4 */
const DATA={
  hormuz:'data/processed/hormuz_daily.csv',
  summary:'data/processed/chokepoints_summary.csv',
  ba:'data/processed/hormuz_before_after.csv',
  events:'data/processed/hormuz_events.csv',
  market:'data/processed/market_prices.csv',
  greekNat:'data/processed/greece_fuel_national.csv',
  greekA95:'data/processed/greece_a95_by_nomos.csv'
};
const TPERIODS={'2026 Jan–May':['2026-01-01','2026-05-17'],'2025':['2025-01-01','2025-12-31'],'Full record':['2019-01-01','2026-05-17']};
const fmt={date:d3.timeFormat('%d %b %Y'),dS:d3.timeFormat('%b %Y'),num:d3.format(',.0f'),one:d3.format(',.1f'),usd:d=>`$${d3.format(',.0f')(d)}`,pct:d3.format('.0%'),sp:d=>`${d>=0?'+':'−'}${d3.format('.0%')(Math.abs(d))}`};
const pd=d3.timeParse('%Y-%m-%d');
const tip=d3.select('#tooltip');
const C={sea:'#0f4d46',sea2:'#74b8a7',orange:'#d36a38',oil:'#1a1a16',soft:'#6d8e86'};
const st={tPeriod:'2026 Jan–May',rkMetric:'avg_tanker',grFuel:'a95'};

Promise.all([
  d3.csv(DATA.hormuz,rH),d3.csv(DATA.summary,rS),d3.csv(DATA.ba,rBA),d3.csv(DATA.events,rE),d3.csv(DATA.market,rM),d3.csv(DATA.greekNat),d3.csv(DATA.greekA95)
]).then(([hz,su,ba,ev,mk,gn,ga])=>{
  const D={hz,su,ba,ev,mk,gn,ga};
  initProgress(); initControls(D); renderAll(D); fillHero(ba,mk);
  window.addEventListener('resize',debounce(()=>renderAll(D),200));
  // Listen for chokepoint clicks from world map iframe
  window.addEventListener('message',e=>{
    if(e.data?.type==='chokepoint-click') highlightBar(e.data.portid);
  });
});

function rH(d){const o={...d,date:pd(d.date)};['n_total','n_tanker','n_cargo','n_container','n_dry_bulk','n_general_cargo','n_roro','capacity','capacity_tanker','n_total_ma7','n_tanker_ma7','capacity_ma7','capacity_tanker_ma7'].forEach(k=>o[k]=+d[k]||0);return o;}
function rS(d){const o={...d};['days','avg_total','avg_tanker','avg_cargo','avg_capacity','avg_tanker_capacity','total_total','total_tanker','total_capacity','tanker_share'].forEach(k=>o[k]=+d[k]||0);return o;}
function rBA(d){const o={...d};['days','avg_total_transits_per_day','avg_tankers_per_day','avg_capacity_per_day','avg_tanker_capacity_per_day'].forEach(k=>o[k]=+d[k]||0);return o;}
function rE(d){return{...d,fromdate_parsed:pd((d.fromdate_parsed||'').slice(0,10))};}
function rM(d){return{date:pd(d.date),brent:+d.brent_usd_per_barrel||null,jet:+d.jet_fuel_usd_per_gallon||null,jetBbl:+d.jet_fuel_usd_per_barrel_equiv||null};}

function initControls(D){
  pills('#traffic-periods',Object.keys(TPERIODS),st.tPeriod,v=>{st.tPeriod=v;renderAll(D);});
  pills('#greece-fuel-pills',['A95','Diesel','LPG'],st.grFuel==='a95'?'A95':'Diesel',v=>{st.grFuel={A95:'a95',Diesel:'diesel_kinisis',LPG:'lpg'}[v];renderAll(D);});
  d3.select('#rank-metric').on('change',ev=>{st.rkMetric=ev.target.value;renderAll(D);});
}
let rerender=()=>{};
function renderAll(D){rerender=()=>renderAll(D);renderRank(D.su);renderMix(D.hz);renderTraffic(D.hz,D.ev);renderImpact(D.hz,D.mk,D.ev);renderBA(D.ba);renderPrices(D.mk);renderGreece(D.gn);renderNomos(D.ga);}

/* Utils */
function pills(s,v,a,cb){d3.select(s).selectAll('button').data(v).join('button').attr('type','button').attr('class',d=>d===a?'is-active':null).text(d=>d).on('click',(_,d)=>cb(d));}
function upP(s,a){d3.select(s).selectAll('button').attr('class',d=>d===a?'is-active':null);}
function fP(d,l){const[s,e]=TPERIODS[l].map(pd);return d.filter(r=>r.date>=s&&r.date<=e);}
function cS(svg,h=300){const n=svg.node(),w=n.clientWidth||680;svg.attr('viewBox',`0 0 ${w} ${h}`);svg.selectAll('*').remove();return{W:w,H:h};}
function showT(ev,h){tip.html(h).style('opacity',1).style('left',`${Math.min(ev.clientX+12,innerWidth-260)}px`).style('top',`${ev.clientY+12}px`);}
function hideT(){tip.style('opacity',0);}
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
function addEv(svg,x,y1,y2,l){svg.append('line').attr('class','event-line').attr('x1',x).attr('x2',x).attr('y1',y1).attr('y2',y2);svg.append('text').attr('x',x+4).attr('y',y1+9).attr('fill',C.orange).attr('font-family','Space Mono').attr('font-size',8).attr('font-weight',700).text(l);}
function addL(svg,x,y,items){const g=svg.append('g').attr('transform',`translate(${x},${y})`);items.forEach((it,i)=>{const gg=g.append('g').attr('transform',`translate(${i*100},0)`);gg.append('rect').attr('width',18).attr('height',6).attr('rx',3).attr('fill',it[1]);gg.append('text').attr('x',22).attr('y',6).attr('font-family','Space Mono').attr('font-size',8).attr('fill',C.soft).text(it[0]);});}
function addH(svg,data,x,m,h,fn){const bi=d3.bisector(d=>d.date).center;const fo=svg.append('g').style('display','none');fo.append('line').attr('y1',m.top).attr('y2',h-m.bottom).attr('stroke','rgba(14,74,66,.18)').attr('stroke-dasharray','3 4');svg.append('rect').attr('fill','transparent').attr('x',m.left).attr('y',m.top).attr('width',x.range()[1]-m.left).attr('height',h-m.top-m.bottom).on('mousemove',ev=>{const d=data[bi(data,x.invert(d3.pointer(ev)[0]))];fo.style('display',null).attr('transform',`translate(${x(d.date)},0)`);showT(ev,fn(d));}).on('mouseleave',()=>{fo.style('display','none');hideT();});}

function initProgress(){const s=document.querySelector('.nav__ship');const fn=()=>{const h=document.documentElement,max=h.scrollHeight-h.clientHeight,pct=max?scrollY/max:0;s.style.left=`${pct*document.querySelector('.nav__progress').clientWidth}px`;};fn();addEventListener('scroll',fn,{passive:true});}
function fillHero(ba,mk){const b=ba.find(d=>d.period.startsWith('Before')),a=ba.find(d=>d.period.startsWith('After'));if(b&&a){document.getElementById('hero-transit-change').textContent=`${fmt.sp(a.avg_total_transits_per_day/b.avg_total_transits_per_day-1)} daily`;}const p=mk.filter(d=>d.date>=pd('2026-01-01')&&d.brent);if(p.length){document.getElementById('hero-brent').textContent=`${fmt.usd(p[p.length-1].brent)}/bbl`;}}

/* CH02 RANKING */
let rankData=[];
function renderRank(su){
  d3.select('#rank-metric').property('value',st.rkMetric);
  const svg=d3.select('#rank-chart'),{W,H}=cS(svg,400);
  const m={top:12,right:52,bottom:24,left:130};
  rankData=su.filter(d=>d.period==='2026 YTD').sort((a,b)=>d3.descending(a[st.rkMetric],b[st.rkMetric]));
  const top=rankData.slice(0,28);if(!top.length)return;
  const max=d3.max(top,d=>d[st.rkMetric])||1;
  const x=d3.scaleLinear().domain([0,max*1.08]).range([m.left,W-m.right]).nice();
  const y=d3.scaleBand().domain(top.map(d=>d.portname)).range([m.top,H-m.bottom]).padding(.15);
  svg.append('g').attr('class','grid').attr('transform',`translate(0,${H-m.bottom})`).call(d3.axisBottom(x).ticks(5).tickSize(-(H-m.top-m.bottom)).tickFormat('')).call(g=>g.select('.domain').remove());
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y).tickSize(0)).call(g=>g.select('.domain').remove()).selectAll('text').style('font-size','7px');
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${H-m.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat(d=>rkF(d,st.rkMetric)));
  const bars=svg.selectAll('.rk').data(top).join('g').attr('class','rk');
  bars.append('rect').attr('x',m.left).attr('y',d=>y(d.portname)).attr('height',y.bandwidth()).attr('rx',4)
    .attr('width',d=>Math.max(0,x(d[st.rkMetric])-m.left))
    .attr('fill',d=>d.portid==='chokepoint6'?C.orange:C.sea).attr('opacity',d=>d.portid==='chokepoint6'?1:.55)
    .attr('data-portid',d=>d.portid)
    .on('mousemove',(ev,d)=>showT(ev,`<strong>${d.portname}</strong>${rkL(st.rkMetric)}: ${rkF(d[st.rkMetric],st.rkMetric)}<br>Tanker share: ${fmt.pct(d.tanker_share)}`))
    .on('mouseleave',hideT)
    .on('click',(ev,d)=>{
      highlightBar(d.portid);
      // Tell world map iframe to highlight
      const iframe=document.getElementById('world-map-iframe');
      if(iframe)iframe.contentWindow.postMessage({type:'highlight-chokepoint',portid:d.portid},'*');
    });
  bars.filter(d=>x(d[st.rkMetric])-m.left>35).append('text').attr('x',d=>x(d[st.rkMetric])+4).attr('y',d=>y(d.portname)+y.bandwidth()/2+3).attr('class','bar-label').style('font-size','7px').text(d=>rkF(d[st.rkMetric],st.rkMetric));
  const rank=rankData.findIndex(d=>d.portid==='chokepoint6')+1;
  d3.select('#rank-read').text(`2026 Jan–May: Hormuz ranks #${rank}/28 for ${rkL(st.rkMetric).toLowerCase()}. Click a bar or map marker — they're linked.`);
}
function highlightBar(pid){
  d3.selectAll('#rank-chart rect[data-portid]').attr('fill',function(){
    const p=d3.select(this).attr('data-portid');
    return p===pid?'#f5c542':p==='chokepoint6'?C.orange:C.sea;
  }).attr('opacity',function(){
    const p=d3.select(this).attr('data-portid');
    return p===pid||p==='chokepoint6'?1:.55;
  });
}
function rkF(v,k){return k==='tanker_share'?fmt.pct(v):k.includes('capacity')?d3.format(',.2s')(v):fmt.one(v);}
function rkL(k){return({avg_total:'Avg daily transits',avg_tanker:'Avg daily tankers',avg_capacity:'Avg daily capacity',tanker_share:'Tanker share'})[k]||k;}

/* CH03 MIX */
function renderMix(hz){
  const svg=d3.select('#mix-chart'),{W,H}=cS(svg,240);
  const data=hz.filter(d=>d.date>=pd('2026-01-01')&&d.date<=pd('2026-05-17'));
  const vals=[
    {label:'Tankers',value:d3.sum(data,d=>d.n_tanker),color:C.orange},
    {label:'Containers',value:d3.sum(data,d=>d.n_container),color:'#0f4d46'},
    {label:'Dry bulk',value:d3.sum(data,d=>d.n_dry_bulk),color:'#74b8a7'},
    {label:'General cargo',value:d3.sum(data,d=>d.n_general_cargo),color:'#8aa78c'},
    {label:'Ro-Ro',value:d3.sum(data,d=>d.n_roro),color:'#c5a760'}
  ];
  const total=d3.sum(vals,d=>d.value)||1;vals.forEach(d=>d.share=d.value/total);
  const cx=W/2,cy=H/2+4,rO=Math.min(cx,cy)-28,rI=rO*.55;
  const pie=d3.pie().value(d=>d.value).sort(null).padAngle(.02);
  const arc=d3.arc().innerRadius(rI).outerRadius(rO).cornerRadius(4);
  svg.selectAll('.arc').data(pie(vals)).join('g').attr('class','arc').attr('transform',`translate(${cx},${cy})`).append('path').attr('d',arc).attr('fill',d=>d.data.color).attr('opacity',.85).on('mousemove',(ev,d)=>showT(ev,`<strong>${d.data.label}</strong>${fmt.num(d.data.value)} transits · ${fmt.pct(d.data.share)}`)).on('mouseleave',hideT);
  svg.append('text').attr('x',cx).attr('y',cy-6).attr('text-anchor','middle').attr('font-family','Space Mono').attr('font-size',9).attr('fill',C.soft).text('TANKER SHARE');
  svg.append('text').attr('x',cx).attr('y',cy+14).attr('text-anchor','middle').attr('font-family','Bebas Neue').attr('font-size',26).attr('fill',C.oil).text(fmt.pct(vals[0].share));
  const lx=W-140,ly=12;vals.forEach((v,i)=>{svg.append('rect').attr('x',lx).attr('y',ly+i*17).attr('width',14).attr('height',6).attr('rx',3).attr('fill',v.color);svg.append('text').attr('x',lx+20).attr('y',ly+i*17+6).attr('font-family','Space Mono').attr('font-size',8).attr('fill',C.soft).text(`${v.label} ${fmt.pct(v.share)}`);});
  d3.select('#mix-read').text(`2026 Jan–May: tankers make up ${fmt.pct(vals[0].share)} of all Hormuz transits. This is why it's an energy chokepoint.`);
}

/* CH04 TRAFFIC */
function renderTraffic(hz,ev){
  upP('#traffic-periods',st.tPeriod);
  const svg=d3.select('#traffic-chart'),{W,H}=cS(svg,320);
  const m={top:18,right:22,bottom:32,left:50};
  const data=fP(hz,st.tPeriod);
  const x=d3.scaleTime().domain(d3.extent(data,d=>d.date)).range([m.left,W-m.right]);
  const y=d3.scaleLinear().domain([0,d3.max(data,d=>d.n_total_ma7)*1.12||1]).nice().range([H-m.bottom,m.top]);
  const yrs=(x.domain()[1]-x.domain()[0])/(864e5*365);
  const xT=yrs<=1?d3.timeMonth.every(1):yrs<=3?d3.timeMonth.every(3):d3.timeYear.every(1);
  svg.append('g').attr('class','grid').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W-m.left-m.right)).tickFormat('')).call(g=>g.select('.domain').remove());
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${H-m.bottom})`).call(d3.axisBottom(x).ticks(xT).tickFormat(yrs<=1?d3.timeFormat('%b %Y'):fmt.dS));
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5));
  svg.append('path').datum(data).attr('fill',C.sea).attr('fill-opacity',.08).attr('d',d3.area().x(d=>x(d.date)).y0(H-m.bottom).y1(d=>y(d.n_total_ma7)).curve(d3.curveMonotoneX));
  svg.append('path').datum(data).attr('fill','none').attr('stroke',C.sea).attr('stroke-width',2.2).attr('d',d3.line().x(d=>x(d.date)).y(d=>y(d.n_total_ma7)).curve(d3.curveMonotoneX));
  svg.append('path').datum(data).attr('fill',C.orange).attr('fill-opacity',.06).attr('d',d3.area().x(d=>x(d.date)).y0(H-m.bottom).y1(d=>y(d.n_tanker_ma7)).curve(d3.curveMonotoneX));
  svg.append('path').datum(data).attr('fill','none').attr('stroke',C.orange).attr('stroke-width',1.6).attr('opacity',.6).attr('d',d3.line().x(d=>x(d.date)).y(d=>y(d.n_tanker_ma7)).curve(d3.curveMonotoneX));
  const evD=ev[0]?.fromdate_parsed||pd('2026-03-01');if(evD>=x.domain()[0]&&evD<=x.domain()[1])addEv(svg,x(evD),m.top,H-m.bottom,'HORMUZ-26');
  const aT=d3.mean(data,d=>d.n_total),aTk=d3.mean(data,d=>d.n_tanker);
  d3.select('#traffic-metrics').selectAll('.metric-card').data([['Avg transits/day',fmt.one(aT),'all types'],['Avg tankers/day',fmt.one(aTk),`${fmt.pct(aTk/aT)} of traffic`],['Days',fmt.num(data.length),st.tPeriod]]).join('article').attr('class','metric-card').html(d=>`<span>${d[0]}</span><strong>${d[1]}</strong><small>${d[2]}</small>`);
  addL(svg,W-m.right-190,m.top+4,[['Total',C.sea],['Tankers',C.orange]]);
  addH(svg,data,x,m,H,d=>`<strong>${fmt.date(d.date)}</strong>Total: ${fmt.num(d.n_total)}<br>Tankers: ${fmt.num(d.n_tanker)}<br>Capacity: ${fmt.num(d.capacity)}`);
}

/* CH05 IMPACT TIMELINE */
function renderImpact(hz,mk,ev){
  const svg=d3.select('#impact-chart'),{W,H}=cS(svg,380);
  const m={top:14,right:22,bottom:30,left:46};
  const s=pd('2026-01-01'),e=pd('2026-05-17');
  const hD=hz.filter(d=>d.date>=s&&d.date<=e),mD=mk.filter(d=>d.date>=s&&d.date<=e&&d.brent);
  if(!hD.length||!mD.length)return;
  const pH=(H-m.top-m.bottom-24)/3;
  const x=d3.scaleTime().domain([s,e]).range([m.left,W-m.right]);
  const evX=x(pd('2026-03-01'));
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${H-m.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat(fmt.dS));
  // Panel 1: Total
  const y1T=m.top,y1B=m.top+pH,y1=d3.scaleLinear().domain([0,d3.max(hD,d=>d.n_total_ma7)*1.15]).range([y1B,y1T]);
  svg.append('g').attr('class','grid').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y1).ticks(3).tickSize(-(W-m.left-m.right)).tickFormat('')).call(g=>g.select('.domain').remove());
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y1).ticks(3));
  svg.append('path').datum(hD).attr('fill',C.sea).attr('fill-opacity',.1).attr('d',d3.area().x(d=>x(d.date)).y0(y1B).y1(d=>y1(d.n_total_ma7)).curve(d3.curveMonotoneX));
  svg.append('path').datum(hD).attr('fill','none').attr('stroke',C.sea).attr('stroke-width',2).attr('d',d3.line().x(d=>x(d.date)).y(d=>y1(d.n_total_ma7)).curve(d3.curveMonotoneX));
  svg.append('text').attr('x',m.left+4).attr('y',y1T+10).attr('font-family','Space Mono').attr('font-size',8).attr('fill',C.sea).attr('font-weight',700).text('TOTAL TRANSITS');
  // Panel 2: Tankers
  const y2T=y1B+12,y2B=y2T+pH,y2=d3.scaleLinear().domain([0,d3.max(hD,d=>d.n_tanker_ma7)*1.15]).range([y2B,y2T]);
  svg.append('g').attr('class','grid').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y2).ticks(3).tickSize(-(W-m.left-m.right)).tickFormat('')).call(g=>g.select('.domain').remove());
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y2).ticks(3));
  svg.append('path').datum(hD).attr('fill',C.orange).attr('fill-opacity',.1).attr('d',d3.area().x(d=>x(d.date)).y0(y2B).y1(d=>y2(d.n_tanker_ma7)).curve(d3.curveMonotoneX));
  svg.append('path').datum(hD).attr('fill','none').attr('stroke',C.orange).attr('stroke-width',2).attr('d',d3.line().x(d=>x(d.date)).y(d=>y2(d.n_tanker_ma7)).curve(d3.curveMonotoneX));
  svg.append('text').attr('x',m.left+4).attr('y',y2T+10).attr('font-family','Space Mono').attr('font-size',8).attr('fill',C.orange).attr('font-weight',700).text('TANKERS');
  // Panel 3: Brent
  const y3T=y2B+12,y3B=H-m.bottom,y3=d3.scaleLinear().domain(d3.extent(mD,d=>d.brent)).nice().range([y3B,y3T]);
  svg.append('g').attr('class','grid').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y3).ticks(3).tickSize(-(W-m.left-m.right)).tickFormat('')).call(g=>g.select('.domain').remove());
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y3).ticks(3).tickFormat(d=>`$${d}`));
  svg.append('path').datum(mD).attr('fill',C.oil).attr('fill-opacity',.06).attr('d',d3.area().x(d=>x(d.date)).y0(y3B).y1(d=>y3(d.brent)).curve(d3.curveMonotoneX));
  svg.append('path').datum(mD).attr('fill','none').attr('stroke',C.oil).attr('stroke-width',2).attr('d',d3.line().x(d=>x(d.date)).y(d=>y3(d.brent)).curve(d3.curveMonotoneX));
  svg.append('text').attr('x',m.left+4).attr('y',y3T+10).attr('font-family','Space Mono').attr('font-size',8).attr('fill',C.oil).attr('font-weight',700).text('BRENT CRUDE');
  // Event line
  svg.append('line').attr('x1',evX).attr('x2',evX).attr('y1',m.top).attr('y2',H-m.bottom).attr('stroke',C.orange).attr('stroke-width',1.5).attr('stroke-dasharray','5 5').attr('opacity',.85);
  svg.append('text').attr('x',evX+4).attr('y',m.top+9).attr('fill',C.orange).attr('font-family','Space Mono').attr('font-size',8).attr('font-weight',700).text('HORMUZ-26');
  // Hover
  const bi=d3.bisector(d=>d.date).center;
  const fo=svg.append('g').style('display','none');fo.append('line').attr('y1',m.top).attr('y2',H-m.bottom).attr('stroke','rgba(14,74,66,.2)').attr('stroke-dasharray','3 3');
  svg.append('rect').attr('fill','transparent').attr('x',m.left).attr('y',m.top).attr('width',W-m.left-m.right).attr('height',H-m.top-m.bottom).on('mousemove',ev=>{const dt=x.invert(d3.pointer(ev)[0]);const h=hD[bi(hD,dt)];const mp=mD[d3.bisector(d=>d.date).center(mD,dt)];fo.style('display',null).attr('transform',`translate(${x(h.date)},0)`);showT(ev,`<strong>${fmt.date(h.date)}</strong>Total: ${fmt.num(h.n_total)}<br>Tankers: ${fmt.num(h.n_tanker)}<br>Brent: ${mp?.brent?fmt.usd(mp.brent):'—'}`);}).on('mouseleave',()=>{fo.style('display','none');hideT();});
  d3.select('#impact-read').text('Three signals on one timeline. HORMUZ-26 triggers a transit collapse and a Brent price response.');
}
function renderBA(ba){
  const b=ba.find(d=>d.period.startsWith('Before')),a=ba.find(d=>d.period.startsWith('After'));if(!b||!a)return;
  const rows=[['Total transits/day',b.avg_total_transits_per_day,a.avg_total_transits_per_day],['Tankers/day',b.avg_tankers_per_day,a.avg_tankers_per_day],['Capacity/day',b.avg_capacity_per_day,a.avg_capacity_per_day]];
  d3.select('#before-after-grid').selectAll('.ba-card').data(rows).join('article').attr('class','ba-card').html(d=>{const p=d[1]?(d[2]/d[1]-1):0;const f=k=>d[0].includes('Capacity')?d3.format(',.2s')(k):fmt.one(k);return`<span class="ba-card__label">${d[0]}</span><span class="ba-card__before">${f(d[1])}</span><span class="ba-card__arrow">↓</span><span class="ba-card__after">${f(d[2])}</span><span class="ba-card__change">${fmt.sp(p)}</span>`;});
}

/* CH06 PRICES */
function renderPrices(mk){
  const svg=d3.select('#price-chart'),{W,H}=cS(svg,300);
  const m={top:16,right:20,bottom:30,left:44};
  const data=mk.filter(d=>d.date>=pd('2025-11-01')&&(d.brent||d.jetBbl));if(data.length<2)return;
  const x=d3.scaleTime().domain(d3.extent(data,d=>d.date)).range([m.left,W-m.right]);
  const y=d3.scaleLinear().domain([0,d3.max(data,d=>Math.max(d.brent||0,d.jetBbl||0))*1.08]).nice().range([H-m.bottom,m.top]);
  svg.append('g').attr('class','grid').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W-m.left-m.right)).tickFormat('')).call(g=>g.select('.domain').remove());
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${H-m.bottom})`).call(d3.axisBottom(x).ticks(6).tickFormat(fmt.dS));
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d=>`$${d}`));
  svg.append('path').datum(data.filter(d=>d.brent)).attr('fill','none').attr('stroke',C.oil).attr('stroke-width',2).attr('d',d3.line().x(d=>x(d.date)).y(d=>y(d.brent)).curve(d3.curveMonotoneX));
  svg.append('path').datum(data.filter(d=>d.jetBbl)).attr('fill','none').attr('stroke',C.orange).attr('stroke-width',2).attr('d',d3.line().x(d=>x(d.date)).y(d=>y(d.jetBbl)).curve(d3.curveMonotoneX));
  addEv(svg,x(pd('2026-03-01')),m.top,H-m.bottom,'HORMUZ-26');
  addL(svg,W-m.right-195,m.top+4,[['Brent crude',C.oil],['Jet fuel/bbl',C.orange]]);
  addH(svg,data,x,m,H,d=>`<strong>${fmt.date(d.date)}</strong>Brent: ${d.brent?fmt.usd(d.brent):'—'}<br>Jet: ${d.jetBbl?fmt.usd(d.jetBbl):'—'}`);
  d3.select('#price-read').text('Nov 2025 – May 2026: global oil benchmarks. The HORMUZ-26 disruption is visible in both series.');
}

/* CH06 GREECE */
function renderGreece(gn){
  const fuelLabel={a95:'Unleaded 95',diesel_kinisis:'Diesel',lpg:'LPG (Autogas)'}[st.grFuel]||st.grFuel;
  upP('#greece-fuel-pills',{a95:'A95',diesel_kinisis:'Diesel',lpg:'LPG'}[st.grFuel]||'A95');
  const svg=d3.select('#greece-chart'),{W,H}=cS(svg,300);
  const m={top:16,right:20,bottom:30,left:44};
  const parseD=d3.timeParse('%Y-%m-%d');
  const data=gn.map(d=>({date:parseD(d.date),val:+d[st.grFuel]||null})).filter(d=>d.date&&d.val);
  if(data.length<2)return;
  const x=d3.scaleTime().domain(d3.extent(data,d=>d.date)).range([m.left,W-m.right]);
  const y=d3.scaleLinear().domain([d3.min(data,d=>d.val)*.95,d3.max(data,d=>d.val)*1.05]).nice().range([H-m.bottom,m.top]);
  svg.append('g').attr('class','grid').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W-m.left-m.right)).tickFormat('')).call(g=>g.select('.domain').remove());
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${H-m.bottom})`).call(d3.axisBottom(x).ticks(6).tickFormat(fmt.dS));
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d=>`€${d.toFixed(2)}`));
  svg.append('path').datum(data).attr('fill',C.sea).attr('fill-opacity',.1).attr('d',d3.area().x(d=>x(d.date)).y0(H-m.bottom).y1(d=>y(d.val)).curve(d3.curveMonotoneX));
  svg.append('path').datum(data).attr('fill','none').attr('stroke',C.sea).attr('stroke-width',2.2).attr('d',d3.line().x(d=>x(d.date)).y(d=>y(d.val)).curve(d3.curveMonotoneX));
  // HORMUZ-26 line
  const evD=pd('2026-03-01');if(evD>=x.domain()[0]&&evD<=x.domain()[1])addEv(svg,x(evD),m.top,H-m.bottom,'HORMUZ-26');
  addH(svg,data,x,m,H,d=>`<strong>${fmt.date(d.date)}</strong>${fuelLabel}: €${d.val.toFixed(3)}/litre`);
  const first=data[0].val,last=data[data.length-1].val,chg=(last/first-1);
  d3.select('#greece-read').text(`${fuelLabel}: €${first.toFixed(3)} → €${last.toFixed(3)} (${fmt.sp(chg)}). Source: fuelprices.gr, Hellenic Ministry of Development.`);
}

/* CH06 NOMOS RANKING */
function renderNomos(ga){
  const svg=d3.select('#nomos-chart'),{W,H}=cS(svg,500);
  const m={top:12,right:50,bottom:24,left:200};
  // Get last date column
  const cols=Object.keys(ga[0]).filter(k=>k!=='nomos');
  const lastCol=cols[cols.length-1];
  let data=ga.map(d=>({nomos:d.nomos.replace('ΝΟΜΟΣ ',''),val:+d[lastCol]||0})).filter(d=>d.val).sort((a,b)=>d3.descending(a.val,b.val));
  const top=data.slice(0,20);if(!top.length)return;
  const ext=[d3.min(top,d=>d.val)*.98,d3.max(top,d=>d.val)*1.01];
  const x=d3.scaleLinear().domain(ext).range([m.left,W-m.right]);
  const y=d3.scaleBand().domain(top.map(d=>d.nomos)).range([m.top,H-m.bottom]).padding(.15);
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y).tickSize(0)).call(g=>g.select('.domain').remove()).selectAll('text').style('font-size','7px');
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${H-m.bottom})`).call(d3.axisBottom(x).ticks(5).tickFormat(d=>`€${d.toFixed(2)}`));
  svg.selectAll('.nm').data(top).join('rect').attr('class','nm').attr('x',m.left).attr('y',d=>y(d.nomos)).attr('width',d=>Math.max(0,x(d.val)-m.left)).attr('height',y.bandwidth()).attr('rx',4).attr('fill',C.sea).attr('opacity',.65).on('mousemove',(ev,d)=>showT(ev,`<strong>${d.nomos}</strong>A95: €${d.val.toFixed(3)}/litre`)).on('mouseleave',hideT);
  svg.selectAll('.nml').data(top).join('text').attr('class','nml bar-label').style('font-size','7px').attr('x',d=>x(d.val)+4).attr('y',d=>y(d.nomos)+y.bandwidth()/2+3).text(d=>`€${d.val.toFixed(3)}`);
}
