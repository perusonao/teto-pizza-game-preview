(()=>{const q=s=>document.querySelector(s),r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return{t:+b.top.toFixed(1),b:+b.bottom.toFixed(1),h:+b.height.toFixed(1)}};
const snap=l=>{const v=visualViewport,list=q('.pantry-sheet__list'),vb=v.offsetTop+v.height,lb=list&&list.getBoundingClientRect(),rows=new Set();
if(lb)document.querySelectorAll('.pantry-tile').forEach(t=>{const b=t.getBoundingClientRect();if(b.top>=lb.top-.5&&b.bottom<=Math.min(lb.bottom,vb)+.5)rows.add(Math.round(b.top))});
return{l,innerH:innerHeight,clientH:document.documentElement.clientHeight,vvH:+v.height.toFixed(1),vvOff:+v.offsetTop.toFixed(1),vvPageTop:+v.pageTop.toFixed(1),scrollY,sheet:r(q('.pantry-sheet')),search:r(q('.pantry-sheet__search-input')),chips:r(q('.pantry-sheet__shelves')),list:r(list),fullRows:rows.size,fit:!!q('.pantry-sheet--fit'),tiles:document.querySelectorAll('.pantry-tile').length,stage:r(q('.pizza-dough')),dock:r(q('.prepare-dock')),active:document.activeElement&&String(document.activeElement.className)}};
window.__hv=[];const push=l=>{window.__hv.push(snap(l))};
['resize','scroll'].forEach(e=>visualViewport.addEventListener(e,()=>push('vv.'+e)));
document.addEventListener('focusin',()=>push('focusin'),true);document.addEventListener('focusout',()=>push('focusout'),true);
window.__snap=l=>{push(l);return JSON.stringify(window.__hv[window.__hv.length-1])};window.__dump=()=>JSON.stringify({ua:navigator.userAgent,standalone:navigator.standalone===true,log:window.__hv});
return 'probe installed: __snap("label") / __dump()'})()
