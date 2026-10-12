const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const palette=['#e9f1df','#f8efc9','#f8e4da','#e6e7f7','#dfeef3','#ffffff'];
let boards=[];try{boards=JSON.parse(localStorage.getItem('outline-boards')||'[]')}catch{}
let board={id:crypto.randomUUID(),title:'A little room to grow',nodes:[],edges:[]},selected=null,tool='select',connectFrom=null,zoom=1,pan={x:0,y:0},history=[],future=[],dirty=true;
const make=(type,text,x,y,w=160,h=68,color=palette[0],size=16)=>({id:crypto.randomUUID(),type,text,x,y,w,h,color,size});
board.nodes=[make('text','Good things start with a little idea.',295,97,490,40,'#ffffff',24),make('text','A plan for something worth growing',380,143,330,30,'#ffffff',14),make('rect','🌱  A little idea',412,209,210,66),make('rect','Explore the possibilities',156,337,205,64,'#f8efc9'),make('rect','Make a plan',414,337,205,64,'#e6e7f7'),make('rect','Bring it to life',672,337,205,64,'#f8e4da'),make('sticky','Stay curious.\nLeave room for surprises.',865,163,170,113,'#f8efc9',16),make('emoji','🌳',41,225,75,85,'#ffffff',58)];
board.edges=[1,2,3].map((_,i)=>({id:crypto.randomUUID(),from:board.nodes[2].id,to:board.nodes[3+i].id}));
function toast(t){$('#toast').textContent=t;$('#toast').style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.opacity=0,2600)}
function checkpoint(){history.push(JSON.stringify(board));if(history.length>70)history.shift();future=[];markDirty()}
function markDirty(){dirty=true;$('#saveState').textContent='Unsaved changes';updateButtons()}
function updateButtons(){$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;$('#duplicate').disabled=!selectedNode();$('#delete').disabled=!selected;const arrowSelected=board.edges.some(e=>e.id===selected);$('#delete').textContent=arrowSelected?'⌫ Delete arrow':'⌫ Delete';$('#delete').title=arrowSelected?'Delete selected arrow':'Delete selection';$('#nodeCount').textContent=board.nodes.length+' elements';$('#count').textContent=boards.length}
function selectedNode(){return board.nodes.find(n=>n.id===selected)}
function render(){const container=$('#nodes');container.replaceChildren();board.nodes.forEach(n=>{let el=document.createElement('div');el.className='node '+n.type+(n.id===selected?' selected':'');el.dataset.id=n.id;el.textContent=n.text;Object.assign(el.style,{left:n.x+'px',top:n.y+'px',width:n.w+'px',height:n.h+'px',background:n.color,fontSize:n.size+'px'});el.addEventListener('pointerdown',e=>nodeDown(e,n));el.addEventListener('dblclick',()=>editNode(n,el));container.append(el)});renderEdges();renderResizeBox();updateButtons();if(tool==='select')$('#hint').textContent=board.edges.some(e=>e.id===selected)?'Arrow selected · Press Delete or click Delete arrow to remove':'Select an element and drag its boundary to resize';const n=selectedNode();if(n){$('#fontSize').value=n.size;$$('.swatch').forEach(b=>b.classList.toggle('active',b.dataset.color===n.color))}}
function edgePath(e){let a=board.nodes.find(n=>n.id===e.from),b=board.nodes.find(n=>n.id===e.to);if(!a||!b)return '';let ax=a.x+a.w/2,ay=a.y+a.h/2,bx=b.x+b.w/2,by=b.y+b.h/2;let vertical=Math.abs(by-ay)>Math.abs(bx-ax)*.5;if(vertical){ay+=Math.sign(by-ay)*a.h/2;by-=Math.sign(by-ay)*b.h/2;let mid=(ay+by)/2;return `M ${ax} ${ay} C ${ax} ${mid}, ${bx} ${mid}, ${bx} ${by}`}ax+=Math.sign(bx-ax)*a.w/2;bx-=Math.sign(bx-ax)*b.w/2;let mid=(ax+bx)/2;return `M ${ax} ${ay} C ${mid} ${ay}, ${mid} ${by}, ${bx} ${by}`}
function renderEdges(){
  const g=$('#edgePaths');g.replaceChildren();
  board.edges.forEach(e=>{
    const path=edgePath(e);
    const visible=document.createElementNS('http://www.w3.org/2000/svg','path');
    visible.setAttribute('d',path);visible.classList.add('edge');
    if(e.id===selected)visible.classList.add('selected-edge');
    g.append(visible);
    const hit=document.createElementNS('http://www.w3.org/2000/svg','path');
    hit.setAttribute('d',path);hit.classList.add('edge-hit');
    hit.setAttribute('stroke-width',16/zoom);
    hit.setAttribute('aria-label','Arrow relationship');
    hit.setAttribute('role','button');hit.setAttribute('tabindex','0');
    function selectArrow(){selected=e.id;setTool('select');render();$('#hint').textContent='Arrow selected · Press Delete or click Delete arrow to remove'}
    hit.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();selectArrow()});
    hit.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();selectArrow()}});
    g.append(hit);
  });
}
function renderResizeBox(){
  const n=selectedNode();let box=$('#selectionBounds');
  if(!n||tool!=='select'||$(`[data-id="${n.id}"]`)?.isContentEditable){box?.remove();return}
  if(!box){
    box=document.createElement('div');box.id='selectionBounds';$('#world').append(box);
    const directions={n:'top',ne:'top right',e:'right',se:'bottom right',s:'bottom',sw:'bottom left',w:'left',nw:'top left'};
    for(const [direction,label] of Object.entries(directions)){
      if(direction.length===1){const edge=document.createElement('div');edge.className='resize-edge resize-'+direction;edge.addEventListener('pointerdown',event=>resizeDown(event,direction));box.append(edge)}
      const handle=document.createElement('button');handle.className='resize-handle resize-'+direction;
      handle.setAttribute('aria-label','Resize '+label);handle.title='Drag to resize';
      handle.addEventListener('pointerdown',event=>resizeDown(event,direction));box.append(handle);
    }
  }
  Object.assign(box.style,{left:n.x+'px',top:n.y+'px',width:n.w+'px',height:n.h+'px',borderWidth:1.5/zoom+'px'});
  box.style.setProperty('--handle-size',12/zoom+'px');
  box.style.setProperty('--edge-hit-size',12/zoom+'px');
}
function resizeDown(event,direction){
  const n=selectedNode();if(!n)return;
  event.preventDefault();event.stopPropagation();
  const origin={...n},pointer={x:event.clientX,y:event.clientY},scaleAtStart=zoom;
  let changed=false;
  const move=ev=>{
    if(ev.pointerId!==event.pointerId)return;
    const dx=(ev.clientX-pointer.x)/scaleAtStart,dy=(ev.clientY-pointer.y)/scaleAtStart;
    if(!changed&&Math.abs(dx)+Math.abs(dy)<1)return;
    if(!changed){checkpoint();changed=true}
    if(n.type==='emoji'){
      // Icons keep their proportions and the opposite boundary stays anchored.
      const sx=direction.includes('e')?1+dx/origin.w:direction.includes('w')?1-dx/origin.w:1;
      const sy=direction.includes('s')?1+dy/origin.h:direction.includes('n')?1-dy/origin.h:1;
      let ratio=direction.length===1?(direction==='e'||direction==='w'?sx:sy):(Math.abs(sx-1)>=Math.abs(sy-1)?sx:sy);
      let maxRatio=800/Math.max(origin.w,origin.h);
      if(direction.includes('w'))maxRatio=Math.min(maxRatio,(origin.x+origin.w)/origin.w);
      if(direction.includes('n'))maxRatio=Math.min(maxRatio,(origin.y+origin.h)/origin.h);
      if(!direction.includes('e')&&!direction.includes('w'))maxRatio=Math.min(maxRatio,1+2*origin.x/origin.w);
      if(!direction.includes('n')&&!direction.includes('s'))maxRatio=Math.min(maxRatio,1+2*origin.y/origin.h);
      ratio=Math.max(24/Math.min(origin.w,origin.h),Math.min(maxRatio,ratio));
      n.w=origin.w*ratio;n.h=origin.h*ratio;n.size=origin.size*ratio;
      n.x=direction.includes('w')?origin.x+origin.w-n.w:direction.includes('e')?origin.x:origin.x+(origin.w-n.w)/2;
      n.y=direction.includes('n')?origin.y+origin.h-n.h:direction.includes('s')?origin.y:origin.y+(origin.h-n.h)/2;
    }else{
      if(direction.includes('e'))n.w=Math.max(32,Math.min(1600,origin.w+dx));
      if(direction.includes('s'))n.h=Math.max(24,Math.min(1200,origin.h+dy));
      if(direction.includes('w')){n.x=Math.max(0,Math.min(origin.x+origin.w-32,origin.x+dx));n.w=origin.x+origin.w-n.x}
      if(direction.includes('n')){n.y=Math.max(0,Math.min(origin.y+origin.h-24,origin.y+dy));n.h=origin.y+origin.h-n.y}
    }
    const el=$(`[data-id="${n.id}"]`);
    Object.assign(el.style,{left:n.x+'px',top:n.y+'px',width:n.w+'px',height:n.h+'px',fontSize:n.size+'px'});
    renderResizeBox();renderEdges();
  };
  const end=ev=>{
    if(ev.pointerId!==event.pointerId)return;
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);
    if(changed)render();
  };
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
}
function nodeDown(e,n){if(e.target.isContentEditable)return;e.stopPropagation();if(tool==='connect'){if(!connectFrom){connectFrom=n.id;selected=n.id;toast('Now click the shape to connect to')}else if(connectFrom!==n.id){if(!board.edges.some(x=>x.from===connectFrom&&x.to===n.id)){checkpoint();board.edges.push({id:crypto.randomUUID(),from:connectFrom,to:n.id})}connectFrom=null;setTool('select')}render();return}selected=n.id;$$('.node').forEach(el=>el.classList.toggle('selected',el.dataset.id===n.id));$('#fontSize').value=n.size;updateButtons();renderResizeBox();renderEdges();let start={x:e.clientX,y:e.clientY,nx:n.x,ny:n.y},moved=false;const move=ev=>{if(!moved){checkpoint();moved=true}n.x=Math.max(0,start.nx+(ev.clientX-start.x)/zoom);n.y=Math.max(0,start.ny+(ev.clientY-start.y)/zoom);let el=$(`[data-id="${n.id}"]`);el.style.left=n.x+'px';el.style.top=n.y+'px';renderResizeBox();renderEdges()};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)}
function editNode(n,el){if(n.type==='emoji')return;checkpoint();el.contentEditable='true';renderResizeBox();el.focus();let range=document.createRange();range.selectNodeContents(el);let selection=getSelection();selection.removeAllRanges();selection.addRange(range);el.addEventListener('blur',()=>{n.text=el.innerText;el.contentEditable='false';render()},{once:true});el.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'||(e.key==='Enter'&&!e.shiftKey)){e.preventDefault();el.blur()}})}
function setTool(t){tool=t;connectFrom=null;$$('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));$('#hint').textContent=t==='connect'?'Click a shape, then another to connect them':'Select an element and drag its boundary to resize'}
function add(type,text){checkpoint();let r=$('#viewport').getBoundingClientRect();let x=Math.max(20,(r.width/2-pan.x)/zoom-80),y=Math.max(90,(r.height/2-pan.y)/zoom-30);let config={rect:['Your idea',160,68],circle:['Start',100,100],diamond:['A decision?',150,110],text:['Add your text',220,45],sticky:['A note to remember',170,110],emoji:[text,75,75]}[type];let n=make(type,text||config[0],x+Math.random()*30,y+Math.random()*30,config[1],config[2],type==='sticky'?palette[1]:palette[0],type==='emoji'?52:16);board.nodes.push(n);selected=n.id;setTool('select');render()}
$$('[data-add]').forEach(b=>b.onclick=()=>add(b.dataset.add));$$('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
for(const color of palette){let b=document.createElement('button');b.className='swatch';b.style.background=color;b.dataset.color=color;b.setAttribute('aria-label','Fill '+color);b.onclick=()=>{let n=selectedNode();if(n){checkpoint();n.color=color;render()}else toast('Select an element to change its color')};$('#colors').append(b)}
const stickers=['🌳','🌲','🌱','🌿','🌸','☀️','☁️','⭐','🌈','🔥','💡','🎯','🚀','🏡','☕','❤️','😊','🎉','📌','🧠','✅','💬','📚','🦋','🐈'];stickers.forEach(s=>{let b=document.createElement('button');b.textContent=s;b.setAttribute('aria-label','Add '+s);b.onclick=()=>{add('emoji',s);$('#stickerPanel').classList.add('hidden')};$('#stickers').append(b)});$('#stickerButton').onclick=()=>$('#stickerPanel').classList.toggle('hidden');$('#closeStickers').onclick=()=>$('#stickerPanel').classList.add('hidden');
$('#fontSize').onchange=()=>{let n=selectedNode();if(n){checkpoint();n.size=+$('#fontSize').value;render()}};
function remove(){if(!selected)return;checkpoint();board.nodes=board.nodes.filter(n=>n.id!==selected);board.edges=board.edges.filter(e=>e.id!==selected&&e.from!==selected&&e.to!==selected);selected=null;render()}
$('#delete').onclick=remove;$('#duplicate').onclick=()=>{let n=selectedNode();if(!n)return;checkpoint();let copy={...n,id:crypto.randomUUID(),x:n.x+30,y:n.y+30};board.nodes.push(copy);selected=copy.id;render()};
$('#undo').onclick=()=>{if(!history.length)return;future.push(JSON.stringify(board));board=JSON.parse(history.pop());selected=null;$('#boardTitle').value=board.title;markDirty();render()};$('#redo').onclick=()=>{if(!future.length)return;history.push(JSON.stringify(board));board=JSON.parse(future.pop());selected=null;$('#boardTitle').value=board.title;markDirty();render()};
function transform(){$('#world').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;$('#zoomLabel').textContent=Math.round(zoom*100)+'%';renderResizeBox();$$('.edge-hit').forEach(el=>el.setAttribute('stroke-width',16/zoom))}
function zoomTo(z){let r=$('#viewport').getBoundingClientRect(),cx=r.width/2,cy=r.height/2;z=Math.max(.25,Math.min(2,z));pan={x:cx-(cx-pan.x)*z/zoom,y:cy-(cy-pan.y)*z/zoom};zoom=z;transform()}
$('#zoomIn').onclick=()=>zoomTo(zoom+.1);$('#zoomOut').onclick=()=>zoomTo(zoom-.1);$('#zoomLabel').onclick=()=>{zoom=1;pan={x:0,y:0};transform()};
function bounds(){if(!board.nodes.length)return {x:0,y:0,w:1000,h:500};let x=Math.min(...board.nodes.map(n=>n.x))-40,y=Math.min(...board.nodes.map(n=>n.y))-40;return {x,y,w:Math.max(...board.nodes.map(n=>n.x+n.w))-x+40,h:Math.max(...board.nodes.map(n=>n.y+n.h))-y+40}}
function fit(){let b=bounds(),r=$('#viewport').getBoundingClientRect();if(r.width<1||r.height<1)return;zoom=Math.min(1.25,(r.width-50)/b.w,(r.height-120)/b.h);pan={x:(r.width-b.w*zoom)/2-b.x*zoom,y:70+(r.height-120-b.h*zoom)/2-b.y*zoom};transform()}
$('#fit').onclick=fit;$('#viewport').addEventListener('pointerdown',e=>{if(e.target.closest('button,.tools,.sticker-panel,.zoom,.node,#selectionBounds,.edge-hit'))return;selected=null;render();let start={sx:e.clientX,sy:e.clientY,px:pan.x,py:pan.y};const move=ev=>{pan={x:start.px+ev.clientX-start.sx,y:start.py+ev.clientY-start.sy};transform()};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)});
$('#viewport').addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoomTo(zoom-e.deltaY*.002)}},{passive:false});
$('#boardTitle').addEventListener('change',()=>{checkpoint();board.title=$('#boardTitle').value.trim()||'Untitled diagram';$('#boardTitle').value=board.title;markDirty()});
function persist(next){try{localStorage.setItem('outline-boards',JSON.stringify(next));boards=next;return true}catch{toast('Could not save: browser storage is unavailable or full. Export your diagram.');return false}}
function save(){board.title=$('#boardTitle').value.trim()||'Untitled diagram';board.updated=new Date().toISOString();let next=boards.filter(b=>b.id!==board.id);next.unshift(JSON.parse(JSON.stringify(board)));if(persist(next)){dirty=false;$('#saveState').textContent='Saved on this device';updateButtons();toast('Creation saved to My creations')}}$('#save').onclick=save;
function newBoard(){if(dirty&&history.length&&!confirm('Start a new canvas? Unsaved changes will be lost.'))return;board={id:crypto.randomUUID(),title:'Untitled diagram',nodes:[],edges:[]};selected=null;history=[];future=[];pan={x:0,y:0};zoom=1;$('#boardTitle').value=board.title;markDirty();setTool('select');transform();render();location.hash='editor'}$('#newBoard').onclick=newBoard;$('#galleryNew').onclick=newBoard;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function svgMarkup(b){let previous=board;board=b;let box=bounds();let paths=b.edges.map(e=>`<path d="${edgePath(e)}" fill="none" stroke="#8c9690" stroke-width="1.6" marker-end="url(#arrow)"/>`).join('');board=previous;let nodes=b.nodes.map(n=>{let shape='';if(!['text','emoji'].includes(n.type)){shape=n.type==='circle'?`<ellipse cx="${n.x+n.w/2}" cy="${n.y+n.h/2}" rx="${n.w/2}" ry="${n.h/2}" fill="${n.color}" stroke="#b3c5a3"/>`:n.type==='diamond'?`<polygon points="${n.x+n.w/2},${n.y} ${n.x+n.w},${n.y+n.h/2} ${n.x+n.w/2},${n.y+n.h} ${n.x},${n.y+n.h/2}" fill="${n.color}" stroke="#b3c5a3"/>`:`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.type==='sticky'?1:10}" fill="${n.color}" stroke="#b3c5a3"/>`}let lines=n.text.split('\n');return shape+`<text text-anchor="middle" font-family="Arial,sans-serif" font-size="${n.size}" fill="#253a30">`+lines.map((l,i)=>`<tspan x="${n.x+n.w/2}" y="${n.y+n.h/2+(i-(lines.length-1)/2)*n.size*1.3+n.size*.35}">${esc(l)}</tspan>`).join('')+'</text>'}).join('');return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8c9690"/></marker></defs>${paths}${nodes}</svg>`}
$('#export').onclick=()=>{let blob=new Blob([svgMarkup(board)],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(board.title||'diagram').replace(/[^a-z0-9 -]/gi,'')+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Diagram exported as SVG')};
function renderGallery(){const query=$('#search').value.toLowerCase();let filtered=boards.filter(b=>b.title.toLowerCase().includes(query));$('#galleryCount').textContent=boards.length+' saved creation'+(boards.length===1?'':'s');$('#boardGrid').replaceChildren();if(!filtered.length){let empty=document.createElement('div');empty.className='empty';empty.innerHTML=`<span>✳</span><h2>${query?'No creations found':'Your next big idea belongs here.'}</h2><p>${query?'Try a different search.':'Save a diagram from the studio and find it here.<br>Your creations are saved in this browser on this device.'}</p>`;$('#boardGrid').append(empty)}filtered.forEach(b=>{let card=document.createElement('article');card.className='board-card';card.tabIndex=0;card.setAttribute('aria-label','Open '+b.title);let preview=document.createElement('div');preview.className='board-preview';preview.innerHTML=svgMarkup(b);card.append(preview);let bottom=document.createElement('div');bottom.className='card-bottom';let title=document.createElement('h3');title.textContent=b.title;bottom.append(title);let meta=document.createElement('div');meta.className='card-meta';meta.innerHTML=`<span>${b.nodes.length} elements · ${new Date(b.updated).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>`;let del=document.createElement('button');del.textContent='Delete';del.setAttribute('aria-label','Delete '+b.title);del.onclick=e=>{e.stopPropagation();if(confirm('Delete “'+b.title+'”?')){if(persist(boards.filter(x=>x.id!==b.id))){renderGallery();updateButtons();toast('Creation deleted')}}};meta.append(del);bottom.append(meta);card.append(bottom);const open=()=>{if(board.id!==b.id&&dirty&&history.length&&!confirm('Open this creation? Unsaved changes will be lost.'))return;board=JSON.parse(JSON.stringify(b));dirty=false;selected=null;history=[];future=[];$('#boardTitle').value=board.title;$('#saveState').textContent='Saved on this device';render();location.hash='editor';route();requestAnimationFrame(fit)};card.onclick=open;card.onkeydown=e=>{if(e.key==='Enter'&&e.target===card)open()};$('#boardGrid').append(card)})}
$('#search').oninput=renderGallery;
function route(){let gallery=location.hash==='#boards';if(gallery&&document.body.classList.contains('editing-fullscreen'))exitEditorFullscreen();$('#editor').classList.toggle('hidden',gallery);$('#gallery').classList.toggle('hidden',!gallery);$('#editorLink').classList.toggle('active',!gallery);$('#boardsLink').classList.toggle('active',gallery);$('#pageLabel').textContent=gallery?'My creations':'Diagram studio';if(gallery)renderGallery()}window.addEventListener('hashchange',route);
window.addEventListener('keydown',e=>{if(e.target.matches('input,select,[contenteditable=true]'))return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove()}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?$('#redo').click():$('#undo').click()}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save()}if(e.key==='Escape'){if(document.body.classList.contains('editing-fullscreen'))exitEditorFullscreen();setTool('select');selected=null;render();$('#stickerPanel').classList.add('hidden')}});window.addEventListener('beforeunload',e=>{if(dirty&&history.length){e.preventDefault();e.returnValue=''}});render();route();requestAnimationFrame(fit);

function setEditorFullscreen(active){
  document.body.classList.toggle('editing-fullscreen',active);
  const button=$('#fullscreen');
  button.setAttribute('aria-pressed',String(active));
  button.setAttribute('aria-label',active?'Exit full screen':'Enter full screen');
  button.title=active?'Exit full screen (Esc)':'Enter full screen';
  button.querySelector('span').textContent=active?'Exit full screen':'Full screen';
  requestAnimationFrame(fit);
}
async function exitEditorFullscreen(){
  setEditorFullscreen(false);
  if(document.fullscreenElement=== $('#editor')){
    try{await document.exitFullscreen()}catch{}
  }
}
$('#fullscreen').onclick=async()=>{
  if(document.body.classList.contains('editing-fullscreen')){await exitEditorFullscreen();return}
  setEditorFullscreen(true);
  const editor=$('#editor');
  if(document.fullscreenEnabled&&editor.requestFullscreen){
    try{await editor.requestFullscreen()}catch{/* The expanded editor still works in embedded browsers. */}
  }
};
document.addEventListener('fullscreenchange',()=>{
  if(!document.fullscreenElement)setEditorFullscreen(false);
  else if(document.fullscreenElement===$('#editor'))setEditorFullscreen(true);
});
// Native fullscreen can resize after its change event; fit to the final canvas size.
new ResizeObserver(()=>requestAnimationFrame(fit)).observe($('#viewport'));
