const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const palette=['#e9f1df','#f8efc9','#f8e4da','#e6e7f7','#dfeef3','#ffffff'];
let galleryPinnedOnly=false;
let viewZoom=1,viewPan={x:0,y:0},viewNodes=[];
let boards=[];try{boards=JSON.parse(localStorage.getItem('outline-boards')||'[]')}catch{}
let board={id:crypto.randomUUID(),title:'A little room to grow',nodes:[],edges:[]},selected=new Set(),tool='select',connectFrom=null,zoom=1,pan={x:0,y:0},history=[],future=[],dirty=true;
const make=(type,text,x,y,w=160,h=68,color=palette[0],size=16)=>({id:crypto.randomUUID(),type,text,x,y,w,h,color,size});
board.nodes=[make('text','Good things start with a little idea.',295,97,490,40,'#ffffff',24),make('text','A plan for something worth growing',380,143,330,30,'#ffffff',14),make('rect','🌱  A little idea',412,209,210,66),make('rect','Explore the possibilities',156,337,205,64,'#f8efc9'),make('rect','Make a plan',414,337,205,64,'#e6e7f7'),make('rect','Bring it to life',672,337,205,64,'#f8e4da'),make('sticky','Stay curious.\nLeave room for surprises.',865,163,170,113,'#f8efc9',16),make('emoji','🌳',41,225,75,85,'#ffffff',58)];
board.edges=[1,2,3].map((_,i)=>({id:crypto.randomUUID(),from:board.nodes[2].id,to:board.nodes[3+i].id}));
function toast(t){(document.fullscreenElement||document.body).append($('#toast'));$('#toast').textContent=t;$('#toast').style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.opacity=0,2600)}
let autosaveTimer=null,snapEnabled=true;
try{snapEnabled=localStorage.getItem('outline-snap')!=='false'}catch{}
function checkpoint(){history.push(JSON.stringify(board));if(history.length>70)history.shift();future=[];markDirty()}
function markDirty(){
  dirty=true;$('#saveState').textContent='Saving…';updateButtons();
  clearTimeout(autosaveTimer);queueMicrotask(writeActiveBoard);
  autosaveTimer=setTimeout(()=>save(true),600);
}
function writeActiveBoard(){
  try{localStorage.setItem('outline-active-board',JSON.stringify({board,dirty}));return true}catch{return false}
}
function groupMembers(n){return n.groupId?board.nodes.filter(item=>item.groupId===n.groupId):[n]}
function expandGroups(ids){const result=new Set(ids);board.nodes.forEach(n=>{if(ids.has(n.id))groupMembers(n).forEach(member=>result.add(member.id))});return result}
function selectionUnits(){
  const units=new Map();selectedNodes().forEach(n=>{const key=n.groupId||n.id;if(!units.has(key))units.set(key,[]);units.get(key).push(n)});
  return [...units.values()].map(nodes=>{const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y));return {nodes,x,y,w:Math.max(...nodes.map(n=>n.x+n.w))-x,h:Math.max(...nodes.map(n=>n.y+n.h))-y}});
}

function selectedNodes(){return board.nodes.filter(n=>selected.has(n.id))}
function selectedNode(){return selected.size===1?selectedNodes()[0]:undefined}
function updateHint(){
  if(tool==='connect')$('#hint').textContent='Click a shape, then another to connect them';
  else if(tool==='pan')$('#hint').textContent='Drag to pan · Switch to Select to choose components';
  else if(selected.size>1)$('#hint').textContent=selected.size+' selected · Drag to move · Arrange to align or group';
  else if(board.edges.some(e=>selected.has(e.id)))$('#hint').textContent='Arrow selected · Press Delete or click Delete arrow to remove';
  else $('#hint').textContent='Shift-click to select multiple · Drag blank canvas to box-select · Space-drag to pan';
}
function updateButtons(){
  $('#undo').disabled=!history.length;$('#redo').disabled=!future.length;
  $('#duplicate').disabled=!selectedNodes().length;$('#delete').disabled=!selected.size;
  const arrowSelected=selected.size===1&&board.edges.some(e=>selected.has(e.id));
  $('#delete').textContent=selected.size>1?'⌫ Delete '+selected.size:arrowSelected?'⌫ Delete arrow':'⌫ Delete';
  $('#delete').title=selected.size>1?'Delete all selected components':arrowSelected?'Delete selected arrow':'Delete selection';
  $('#nodeCount').textContent=board.nodes.length+' elements'+(selected.size?' · '+selected.size+' selected':'');$('#count').textContent=boards.length;
  const nodes=selectedNodes(),units=selectionUnits();
  const sameGroup=nodes.length>1&&nodes[0].groupId&&nodes.every(n=>n.groupId===nodes[0].groupId);
  $('#groupSelection').disabled=nodes.length<2||sameGroup;
  $('#ungroupSelection').disabled=!nodes.some(n=>n.groupId);
  $$('[data-align]').forEach(button=>button.disabled=units.length<(button.dataset.align.startsWith('distribute')?3:2));
  updateHint();
}

function refreshSelection(){
  $$('.node').forEach(el=>{el.classList.toggle('selected',selected.has(el.dataset.id));el.classList.toggle('multi-selected',selected.size>1&&selected.has(el.dataset.id))});
  renderEdges();renderResizeBox();updateButtons();
}
function plannerField(n,field,key){
  let recorded=false;field.addEventListener('focus',()=>recorded=false);
  field.addEventListener('input',()=>{if(!recorded){checkpoint();recorded=true}if(key==='title')n.text=field.value;else n.sections={...n.sections,[key]:field.value};markDirty()});
  field.addEventListener('keydown',event=>event.stopPropagation());
}
function renderPlanner(n,el){
  const heading=document.createElement('div');heading.className='planner-heading';
  const grip=document.createElement('span');grip.className='planner-grip';grip.textContent='⠿';grip.title='Drag to move the planner';heading.append(grip);
  const title=document.createElement('input');title.className='planner-title';title.value=n.text;title.placeholder='My daily routine';title.setAttribute('aria-label','Daily planner title');plannerField(n,title,'title');heading.append(title);el.append(heading);
  for(const [key,label,icon] of [['morning','Morning','🌅'],['afternoon','Afternoon','☀️'],['night','Night','🌙']]){
    const section=document.createElement('label');section.className='planner-section '+key;
    const caption=document.createElement('span');caption.className='planner-caption';caption.textContent=icon+' '+label;section.append(caption);
    const text=document.createElement('textarea');text.value=n.sections?.[key]||'';text.placeholder='One task per line…';text.setAttribute('aria-label',label+' tasks');text.spellcheck=true;plannerField(n,text,key);section.append(text);el.append(section);
  }
}
function render(){
  const container=$('#nodes');container.replaceChildren();
  board.nodes.forEach(n=>{
    let el=document.createElement('div');el.className='node '+n.type;el.dataset.id=n.id;if(n.type==='planner')renderPlanner(n,el);else el.textContent=n.text;
    Object.assign(el.style,{left:n.x+'px',top:n.y+'px',width:n.w+'px',height:n.h+'px',background:n.color,fontSize:n.size+'px'});
    el.addEventListener('pointerdown',e=>nodeDown(e,n));el.addEventListener('dblclick',()=>editNode(n,el));container.append(el);
  });
  refreshSelection();const n=selectedNode();
  if(n){$('#fontSize').value=n.size;$$('.swatch').forEach(b=>b.classList.toggle('active',b.dataset.color===n.color))}
}
function edgePath(e,nodes=board.nodes){let a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);if(!a||!b)return '';let ax=a.x+a.w/2,ay=a.y+a.h/2,bx=b.x+b.w/2,by=b.y+b.h/2;let vertical=Math.abs(by-ay)>Math.abs(bx-ax)*.5;if(vertical){ay+=Math.sign(by-ay)*a.h/2;by-=Math.sign(by-ay)*b.h/2;let mid=(ay+by)/2;return `M ${ax} ${ay} C ${ax} ${mid}, ${bx} ${mid}, ${bx} ${by}`}ax+=Math.sign(bx-ax)*a.w/2;bx-=Math.sign(bx-ax)*b.w/2;let mid=(ax+bx)/2;return `M ${ax} ${ay} C ${mid} ${ay}, ${mid} ${by}, ${bx} ${by}`}
function renderEdges(){
  const g=$('#edgePaths');g.replaceChildren();
  board.edges.forEach(e=>{
    const path=edgePath(e);
    const visible=document.createElementNS('http://www.w3.org/2000/svg','path');
    visible.setAttribute('d',path);visible.classList.add('edge');
    if(selected.has(e.id))visible.classList.add('selected-edge');
    g.append(visible);
    const hit=document.createElementNS('http://www.w3.org/2000/svg','path');
    hit.setAttribute('d',path);hit.classList.add('edge-hit');
    hit.setAttribute('stroke-width',16/zoom);
    hit.setAttribute('aria-label','Arrow relationship');
    hit.setAttribute('role','button');hit.setAttribute('tabindex','0');
    function selectArrow(event){
      if(event.shiftKey||event.metaKey||event.ctrlKey){selected.has(e.id)?selected.delete(e.id):selected.add(e.id)}
      else selected=new Set([e.id]);
      setTool('select');refreshSelection();
    }
    hit.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();selectArrow(event)});
    hit.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();selectArrow(event)}});
    g.append(hit);
  });
}
function renderResizeBox(){
  let group=$('#groupBounds');const nodes=selectedNodes();
  if(nodes.length>1&&tool==='select'){
    if(!group){group=document.createElement('div');group.id='groupBounds';$('#world').append(group)}
    const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y));
    Object.assign(group.style,{left:x+'px',top:y+'px',width:Math.max(...nodes.map(n=>n.x+n.w))-x+'px',height:Math.max(...nodes.map(n=>n.y+n.h))-y+'px',borderWidth:1.5/zoom+'px'});
  }else group?.remove();
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
      const minW=n.type==='planner'?260:32,minH=n.type==='planner'?320:24;
      if(direction.includes('e'))n.w=Math.max(minW,Math.min(1600,origin.w+dx));
      if(direction.includes('s'))n.h=Math.max(minH,Math.min(1200,origin.h+dy));
      if(direction.includes('w')){n.x=Math.max(0,Math.min(origin.x+origin.w-minW,origin.x+dx));n.w=origin.x+origin.w-n.x}
      if(direction.includes('n')){n.y=Math.max(0,Math.min(origin.y+origin.h-minH,origin.y+dy));n.h=origin.y+origin.h-n.y}
    }
    const el=$(`[data-id="${n.id}"]`);
    Object.assign(el.style,{left:n.x+'px',top:n.y+'px',width:n.w+'px',height:n.h+'px',fontSize:n.size+'px'});
    renderResizeBox();renderEdges();markDirty();
  };
  const end=ev=>{
    if(ev.pointerId!==event.pointerId)return;
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);
    if(changed)render();
  };
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
}
function nodeDown(e,n){
  if(e.target.isContentEditable||e.target.closest('input,textarea,label')||e.button!==0)return;
  if(tool==='pan'||spaceHeld){startCanvasPan(e);return}
  e.stopPropagation();
  if(tool==='connect'){
    if(!connectFrom){connectFrom=n.id;selected=new Set([n.id]);toast('Now click the shape to connect to')}
    else if(connectFrom!==n.id){
      if(!board.edges.some(x=>x.from===connectFrom&&x.to===n.id)){checkpoint();board.edges.push({id:crypto.randomUUID(),from:connectFrom,to:n.id})}
      connectFrom=null;setTool('select');
    }
    refreshSelection();return;
  }
  if(e.shiftKey||e.metaKey||e.ctrlKey){
    const members=e.altKey?[n]:groupMembers(n);const remove=members.every(member=>selected.has(member.id));members.forEach(member=>remove?selected.delete(member.id):selected.add(member.id));refreshSelection();return;
  }
  if(e.altKey)selected=new Set([n.id]);
  else if(!selected.has(n.id))selected=new Set(groupMembers(n).map(member=>member.id));
  else selected=expandGroups(selected);
  refreshSelection();$('#fontSize').value=n.size;
  const start={x:e.clientX,y:e.clientY,zoom},origins=selectedNodes().map(node=>({node,x:node.x,y:node.y}));
  const minX=Math.min(...origins.map(o=>o.x)),minY=Math.min(...origins.map(o=>o.y));let moved=false;
  const move=ev=>{
    if(ev.pointerId!==e.pointerId)return;
    let dx=(ev.clientX-start.x)/start.zoom,dy=(ev.clientY-start.y)/start.zoom;
    if(!moved&&Math.abs(dx)+Math.abs(dy)<2)return;
    if(!moved){checkpoint();moved=true}
    const adjustment=snapMovement(origins,dx,dy,e.altKey||ev.altKey);
    dx=Math.max(-minX,adjustment.dx);dy=Math.max(-minY,adjustment.dy);
    origins.forEach(({node,x,y})=>{node.x=x+dx;node.y=y+dy;const el=$(`[data-id="${node.id}"]`);el.style.left=node.x+'px';el.style.top=node.y+'px'});
    renderResizeBox();renderEdges();markDirty();
  };
  const up=ev=>{if(ev.pointerId!==e.pointerId)return;$('#alignGuides')?.remove();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up)};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
}
function editNode(n,el){if(n.type==='emoji'||n.type==='planner')return;selected=new Set([n.id]);refreshSelection();checkpoint();el.contentEditable='true';el.addEventListener('input',()=>{n.text=el.innerText;markDirty()});renderResizeBox();el.focus();let range=document.createRange();range.selectNodeContents(el);let selection=getSelection();selection.removeAllRanges();selection.addRange(range);el.addEventListener('blur',()=>{n.text=el.innerText;el.contentEditable='false';markDirty();render()},{once:true});el.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'||(e.key==='Enter'&&!e.shiftKey)){e.preventDefault();el.blur()}})}
function setTool(t){tool=t;connectFrom=null;$$('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));$('#viewport').classList.toggle('pan-mode',t==='pan');renderResizeBox();updateHint()}
function add(type,text){checkpoint();let r=$('#viewport').getBoundingClientRect();let x=Math.max(20,(r.width/2-pan.x)/zoom-80),y=Math.max(90,(r.height/2-pan.y)/zoom-30);let config={rect:['Your idea',160,68],circle:['Start',100,100],diamond:['A decision?',150,110],text:['Add your text',220,45],sticky:['A note to remember',170,110],emoji:[text,75,75],planner:['My daily routine',320,440]}[type];let n=make(type,text||config[0],x+Math.random()*30,y+Math.random()*30,config[1],config[2],type==='sticky'?palette[1]:palette[0],type==='emoji'?52:16);if(type==='planner'){n.color='#ffffff';n.sections={morning:'',afternoon:'',night:''};n.x=Math.max(20,(r.width/2-pan.x)/zoom-n.w/2);n.y=Math.max(90,(r.height/2-pan.y)/zoom-n.h/2)}board.nodes.push(n);selected=new Set([n.id]);setTool('select');render();if(type==='planner')requestAnimationFrame(fit)}
$$('[data-add]').forEach(b=>b.onclick=()=>add(b.dataset.add));$$('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
for(const color of palette){let b=document.createElement('button');b.className='swatch';b.style.background=color;b.dataset.color=color;b.setAttribute('aria-label','Fill '+color);b.onclick=()=>{let n=selectedNode();if(n){checkpoint();n.color=color;render()}else toast('Select an element to change its color')};$('#colors').append(b)}
const iconGroups={
 'Nature':[['🌳','Tree forest oak'],['🌲','Pine tree forest'],['🌴','Palm tree tropical'],['🌱','Seedling grow plant'],['🌿','Herb leaves plant'],['🍀','Clover luck'],['🍁','Autumn maple leaf'],['🍄','Mushroom'],['🌸','Cherry blossom flower'],['🌻','Sunflower'],['🌷','Tulip flower'],['🌵','Cactus desert'],['🪴','Potted plant home'],['🏔️','Mountain hiking'],['🌊','Wave ocean sea'],['☀️','Sun morning sunny'],['🌙','Moon night sleep'],['☁️','Cloud weather'],['🌧️','Rain weather'],['❄️','Snow winter'],['🌈','Rainbow'],['⭐','Star'],['🔥','Fire'],['🦋','Butterfly'],['🐝','Bee'],['🐈','Cat pet'],['🐕','Dog pet'],['🐦','Bird'],['🐢','Turtle'],['🐟','Fish']],
 'Daily life':[['🌅','Sunrise morning'],['🌇','Sunset afternoon evening'],['🛏️','Bed sleep night'],['⏰','Alarm wake morning'],['🪥','Toothbrush teeth morning'],['🧼','Soap wash skincare facewash'],['🚿','Shower bath'],['🧴','Lotion skincare scalp'],['💊','Pill supplement vitamins creatine'],['💧','Water hydrate drink'],['🥤','Drink smoothie protein'],['☕','Coffee tea morning'],['🍵','Tea matcha'],['🥣','Breakfast cereal morning'],['🍳','Egg cooking breakfast'],['🥗','Salad lunch food'],['🍚','Rice dinner food'],['🍎','Apple fruit food'],['🍌','Banana fruit'],['🥑','Avocado'],['🧘','Meditation breathing mindfulness yoga'],['🏃','Run exercise cardio'],['🚶','Walk steps short walk'],['💪','Strength pushups workout'],['🏋️','Weights gym exercise'],['🚴','Cycling bike exercise'],['🏊','Swimming exercise'],['📖','Reading book'],['🎧','Headphones music podcast'],['📵','No phone unplug focus']],
 'People & feelings':[['😊','Happy smile'],['😎','Cool confident'],['🤔','Thinking question'],['😌','Calm relaxed'],['🥳','Celebration party'],['😴','Sleep tired'],['🤩','Excited inspired'],['🥰','Love grateful'],['🙌','Celebrate hands'],['👏','Clap applause'],['👍','Thumbs up yes'],['👎','Thumbs down no'],['👋','Wave hello'],['🤝','Handshake agreement'],['🙏','Thanks prayer gratitude'],['❤️','Heart love'],['💛','Yellow heart'],['💚','Green heart'],['💙','Blue heart'],['🧠','Brain mind learning'],['👤','Person user'],['👥','People team group'],['👨‍👩‍👧','Family'],['🧑‍💻','Developer work computer']],
 'Home & places':[['🏡','Home house garden'],['🏠','House home'],['🏢','Office building work'],['🏫','School education'],['🏥','Hospital health doctor'],['🏦','Bank money'],['🏪','Shop store'],['🏕️','Camping tent'],['🏖️','Beach vacation'],['🛋️','Sofa living room rest'],['🪑','Chair seat'],['🪟','Window'],['🚪','Door entrance'],['💡','Light bulb idea'],['🕯️','Candle'],['🔑','Key access'],['🧹','Broom clean chores'],['🧺','Basket laundry'],['🧽','Sponge clean'],['🗑️','Trash bin delete'],['🛒','Shopping cart groceries'],['🛠️','Tools repair fix']],
 'Work & learning':[['💻','Laptop computer work'],['🖥️','Desktop monitor'],['📱','Phone mobile'],['⌨️','Keyboard'],['🖱️','Mouse'],['📚','Books study learning'],['🎓','Graduation education'],['✏️','Pencil write'],['📝','Memo notes journal'],['📋','Clipboard checklist tasks'],['📅','Calendar schedule plan'],['📌','Pin reminder'],['📎','Paperclip attach'],['📁','Folder files'],['📊','Chart statistics analytics'],['📈','Growth progress chart'],['💼','Briefcase business work'],['✉️','Email mail message'],['💬','Chat conversation'],['📞','Call telephone'],['🎯','Target goal focus'],['🚀','Rocket launch'],['🧩','Puzzle problem solution'],['⚙️','Settings gear process'],['🔍','Search research'],['🔬','Microscope science'],['🧪','Experiment science'],['⏳','Hourglass time wait'],['⏱️','Timer stopwatch focus'],['🏆','Trophy achievement'],['💰','Money budget savings'],['💳','Credit card payment']],
 'Travel & play':[['🚗','Car drive transport'],['🚌','Bus transport'],['🚆','Train transport'],['🚲','Bicycle bike'],['✈️','Plane flight travel'],['🚢','Ship boat travel'],['🧳','Suitcase luggage travel'],['🗺️','Map directions travel'],['📍','Location place destination'],['🧭','Compass direction'],['⛽','Fuel petrol gas'],['🚦','Traffic light'],['🎨','Art paint creativity'],['🎵','Music song'],['🎹','Piano music'],['🎸','Guitar music'],['📷','Camera photography'],['🎬','Movie film cinema'],['🎮','Game controller play'],['🎲','Dice game'],['⚽','Football soccer sport'],['🏀','Basketball sport'],['🎾','Tennis sport'],['🎁','Gift present'],['🎉','Party celebration'],['🎈','Balloon birthday']],
 'Symbols':[['✅','Check done complete yes'],['☑️','Checkbox task done'],['❌','Cross no cancel'],['❓','Question help'],['❗','Important exclamation'],['⚠️','Warning attention'],['🚫','Prohibited stop'],['🔒','Lock secure private'],['🔓','Unlock open'],['🔔','Bell notification reminder'],['🔕','Mute silent'],['🔗','Link connection'],['♻️','Recycle reuse'],['🔄','Repeat cycle refresh routine'],['➡️','Arrow right'],['⬅️','Arrow left'],['⬆️','Arrow up'],['⬇️','Arrow down'],['➕','Plus add'],['➖','Minus subtract'],['💯','Hundred perfect'],['✨','Sparkles magic'],['💤','Sleep rest night'],['🔴','Red circle'],['🟠','Orange circle'],['🟡','Yellow circle'],['🟢','Green circle'],['🔵','Blue circle'],['🟣','Purple circle']]
};
const iconLibrary=Object.entries(iconGroups).flatMap(([category,items])=>items.map(([emoji,name])=>({emoji,name,category})));
let iconCategory='All';
function renderIcons(){
 const words=$('#iconSearch').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
 const matches=iconLibrary.filter(i=>(iconCategory==='All'||i.category===iconCategory)&&words.every(w=>(i.name+' '+i.category+' '+i.emoji).toLowerCase().includes(w)));
 $('#stickers').replaceChildren();
 matches.forEach(i=>{
  const b=document.createElement('button');b.type='button';b.textContent=i.emoji;b.title=i.name;b.setAttribute('aria-label','Add '+i.name);
  b.onclick=()=>{add('emoji',i.emoji);closeIcons();$('#stickerButton').focus()};$('#stickers').append(b);
 });
 $('#iconResults').textContent=matches.length+(matches.length===1?' icon':' icons')+(iconCategory==='All'?'':' · '+iconCategory);
 $('#iconEmpty').classList.toggle('hidden',matches.length>0);
 $$('#iconCategories button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===iconCategory)));
}
['All',...Object.keys(iconGroups)].forEach(category=>{
 const b=document.createElement('button');b.type='button';b.textContent=category;b.onclick=()=>{iconCategory=category;renderIcons()};$('#iconCategories').append(b);
});
function closeIcons(){$('#stickerPanel').classList.add('hidden');$('#stickerButton').setAttribute('aria-expanded','false')}
$('#iconSearch').oninput=renderIcons;
$('#stickerButton').onclick=()=>{
 const open=$('#stickerPanel').classList.contains('hidden');$('#stickerPanel').classList.toggle('hidden',!open);$('#stickerButton').setAttribute('aria-expanded',String(open));
 if(open){renderIcons();$('#iconSearch').focus()}
};
$('#closeStickers').onclick=()=>{closeIcons();$('#stickerButton').focus()};
$('#stickerPanel').addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeIcons();$('#stickerButton').focus()}});
renderIcons();
$('#fontSize').onchange=()=>{let n=selectedNode();if(n){checkpoint();n.size=+$('#fontSize').value;render()}};
function remove(){
  if(!selected.size)return;checkpoint();
  board.nodes=board.nodes.filter(n=>!selected.has(n.id));
  board.edges=board.edges.filter(e=>!selected.has(e.id)&&!selected.has(e.from)&&!selected.has(e.to));
  selected.clear();render();
}
$('#delete').onclick=remove;
$('#duplicate').onclick=()=>{
  const nodes=selectedNodes();if(!nodes.length)return;checkpoint();
  const ids=new Map(),groups=new Map(),copies=nodes.map(n=>{const id=crypto.randomUUID();ids.set(n.id,id);if(n.groupId&&!groups.has(n.groupId))groups.set(n.groupId,crypto.randomUUID());return {...n,sections:n.sections?{...n.sections}:undefined,id,groupId:n.groupId?groups.get(n.groupId):undefined,x:n.x+30,y:n.y+30}});
  const edges=board.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>({...e,id:crypto.randomUUID(),from:ids.get(e.from),to:ids.get(e.to)}));
  board.nodes.push(...copies);board.edges.push(...edges);selected=new Set(copies.map(n=>n.id));render();
};
$('#undo').onclick=()=>{if(!history.length)return;future.push(JSON.stringify(board));board=JSON.parse(history.pop());selected.clear();$('#boardTitle').value=board.title;markDirty();render()};$('#redo').onclick=()=>{if(!future.length)return;history.push(JSON.stringify(board));board=JSON.parse(future.pop());selected.clear();$('#boardTitle').value=board.title;markDirty();render()};
function transform(){$('#world').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;$('#zoomLabel').textContent=Math.round(zoom*100)+'%';$('#viewport').style.backgroundSize=20*zoom+'px '+20*zoom+'px';$('#viewport').style.backgroundPosition=pan.x+'px '+pan.y+'px';renderResizeBox();$$('.edge-hit').forEach(el=>el.setAttribute('stroke-width',16/zoom))}
function zoomTo(z){let r=$('#viewport').getBoundingClientRect(),cx=r.width/2,cy=r.height/2;z=Math.max(.25,Math.min(2,z));pan={x:cx-(cx-pan.x)*z/zoom,y:cy-(cy-pan.y)*z/zoom};zoom=z;transform()}
$('#zoomIn').onclick=()=>zoomTo(zoom+.1);$('#zoomOut').onclick=()=>zoomTo(zoom-.1);$('#zoomLabel').onclick=()=>{zoom=1;pan={x:0,y:0};transform()};
function bounds(){if(!board.nodes.length)return {x:0,y:0,w:1000,h:500};let x=Math.min(...board.nodes.map(n=>n.x))-40,y=Math.min(...board.nodes.map(n=>n.y))-40;return {x,y,w:Math.max(...board.nodes.map(n=>n.x+n.w))-x+40,h:Math.max(...board.nodes.map(n=>n.y+n.h))-y+40}}
function fit(){let b=bounds(),r=$('#viewport').getBoundingClientRect();if(r.width<1||r.height<1)return;zoom=Math.min(1.25,(r.width-50)/b.w,(r.height-120)/b.h);pan={x:(r.width-b.w*zoom)/2-b.x*zoom,y:70+(r.height-120-b.h*zoom)/2-b.y*zoom};transform()}
let spaceHeld=false;
function startCanvasPan(e){
  e.preventDefault();e.stopPropagation();
  const start={sx:e.clientX,sy:e.clientY,px:pan.x,py:pan.y};
  const move=ev=>{if(ev.pointerId!==e.pointerId)return;pan={x:start.px+ev.clientX-start.sx,y:start.py+ev.clientY-start.sy};transform()};
  const end=ev=>{if(ev.pointerId!==e.pointerId)return;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end)};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
}
$('#fit').onclick=fit;
$('#viewport').addEventListener('pointerdown',e=>{
  if(e.target.closest('button,.tools,.sticker-panel,.arrange-panel,.zoom,.node,#selectionBounds,.edge-hit'))return;
  if(tool==='pan'||spaceHeld||e.button===1){startCanvasPan(e);return}
  if(e.button!==0)return;
  e.preventDefault();
  if(tool==='connect'){connectFrom=null;return}
  const additive=e.shiftKey||e.metaKey||e.ctrlKey,previous=new Set(additive?selected:[]);
  selected=new Set(previous);refreshSelection();
  const start={x:e.clientX,y:e.clientY},worldRect=$('#world').getBoundingClientRect(),scale=zoom;
  const marquee=document.createElement('div');marquee.id='selectionMarquee';$('#world').append(marquee);
  const move=ev=>{
    if(ev.pointerId!==e.pointerId)return;
    const left=(Math.min(start.x,ev.clientX)-worldRect.left)/scale,top=(Math.min(start.y,ev.clientY)-worldRect.top)/scale;
    const width=Math.abs(ev.clientX-start.x)/scale,height=Math.abs(ev.clientY-start.y)/scale;
    Object.assign(marquee.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px',borderWidth:1/scale+'px'});
    if(width+height<3)return;
    selected=new Set(previous);
    board.nodes.forEach(n=>{if(n.x+n.w>=left&&n.x<=left+width&&n.y+n.h>=top&&n.y<=top+height)selected.add(n.id)});
    selected=expandGroups(selected);refreshSelection();
  };
  const end=ev=>{if(ev.pointerId!==e.pointerId)return;marquee.remove();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end)};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
});
window.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select,[contenteditable=true]')||$('#editor').classList.contains('hidden'))return;
  if(e.code==='Space'){e.preventDefault();spaceHeld=true;$('#viewport').classList.add('pan-mode')}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'){e.preventDefault();selected=new Set(board.nodes.map(n=>n.id));refreshSelection()}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceHeld=false;$('#viewport').classList.toggle('pan-mode',tool==='pan')}});
window.addEventListener('blur',()=>{spaceHeld=false;$('#viewport').classList.toggle('pan-mode',tool==='pan')});
$('#viewport').addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoomTo(zoom-e.deltaY*.002)}},{passive:false});
let titleCheckpoint=false;
$('#boardTitle').addEventListener('focus',()=>titleCheckpoint=false);
$('#boardTitle').addEventListener('input',()=>{if(!titleCheckpoint){checkpoint();titleCheckpoint=true}board.title=$('#boardTitle').value.trim()||'Untitled diagram';markDirty()});
function persist(next){try{localStorage.setItem('outline-boards',JSON.stringify(next));boards=next;return true}catch{toast('Could not save: browser storage is unavailable or full. Export your diagram.');return false}}
function save(automatic=false){
  clearTimeout(autosaveTimer);board.title=$('#boardTitle').value.trim()||'Untitled diagram';board.updated=new Date().toISOString();
  const next=boards.filter(b=>b.id!==board.id);next.unshift(JSON.parse(JSON.stringify(board)));
  if(persist(next)){dirty=false;writeActiveBoard();$('#saveState').textContent='Saved · Autosave on';updateButtons();if(!automatic)toast('Creation saved to My creations');return true}
  $('#saveState').textContent='Could not save · Export a copy';writeActiveBoard();return false;
}
$('#save').onclick=async()=>{
  if(!save())return;
  if(document.body.classList.contains('editing-fullscreen'))await exitEditorFullscreen();
  toast('Creation saved to My creations');
};
function newBoard(){
  if(dirty&&!save(true)){toast('Save failed. Export your current diagram before starting a new one.');return}
  clearTimeout(autosaveTimer);board={id:crypto.randomUUID(),title:'Untitled diagram',nodes:[],edges:[]};dirty=false;
  selected.clear();history=[];future=[];pan={x:0,y:0};zoom=1;$('#boardTitle').value=board.title;$('#saveState').textContent='Ready · Autosave on';writeActiveBoard();
  setTool('select');transform();render();location.hash='editor';
}
$('#newBoard').onclick=newBoard;$('#galleryNew').onclick=newBoard;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function svgMarkup(b){let previous=board;board=b;let box=bounds();let paths=b.edges.map(e=>`<path d="${edgePath(e)}" fill="none" stroke="#8c9690" stroke-width="1.6" marker-end="url(#arrow)"/>`).join('');board=previous;let nodes=b.nodes.map(n=>{if(n.type==='planner')return plannerSvg(n);let shape='';if(!['text','emoji'].includes(n.type)){shape=n.type==='circle'?`<ellipse cx="${n.x+n.w/2}" cy="${n.y+n.h/2}" rx="${n.w/2}" ry="${n.h/2}" fill="${n.color}" stroke="#b3c5a3"/>`:n.type==='diamond'?`<polygon points="${n.x+n.w/2},${n.y} ${n.x+n.w},${n.y+n.h/2} ${n.x+n.w/2},${n.y+n.h} ${n.x},${n.y+n.h/2}" fill="${n.color}" stroke="#b3c5a3"/>`:`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.type==='sticky'?1:10}" fill="${n.color}" stroke="#b3c5a3"/>`}let lines=n.text.split('\n');return shape+`<text text-anchor="middle" font-family="Arial,sans-serif" font-size="${n.size}" fill="#253a30">`+lines.map((l,i)=>`<tspan x="${n.x+n.w/2}" y="${n.y+n.h/2+(i-(lines.length-1)/2)*n.size*1.3+n.size*.35}">${esc(l)}</tspan>`).join('')+'</text>'}).join('');return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8c9690"/></marker></defs>${paths}${nodes}</svg>`}
$('#export').onclick=()=>{let blob=new Blob([svgMarkup(board)],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(board.title||'diagram').replace(/[^a-z0-9 -]/gi,'')+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Diagram exported as SVG')};
function togglePin(b){
  const pinned=!b.pinned,next=boards.map(item=>item.id===b.id?{...item,pinned}:item);
  if(!persist(next))return;
  if(board.id===b.id){board.pinned=pinned;writeActiveBoard()}
  renderGallery();toast(pinned?'Creation pinned':'Creation unpinned');
}
function renderGallery(){
  const query=$('#search').value.toLowerCase();
  const filtered=boards.filter(b=>b.title.toLowerCase().includes(query)&&(!galleryPinnedOnly||b.pinned)).sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned)));
  $('#galleryCount').textContent=boards.length+' saved · '+boards.filter(b=>b.pinned).length+' pinned';
  $('#allCreations').classList.toggle('active',!galleryPinnedOnly);$('#allCreations').setAttribute('aria-pressed',String(!galleryPinnedOnly));
  $('#pinnedCreations').classList.toggle('active',galleryPinnedOnly);$('#pinnedCreations').setAttribute('aria-pressed',String(galleryPinnedOnly));
  $('#boardGrid').replaceChildren();
  if(!filtered.length){
    const empty=document.createElement('div');empty.className='empty';
    empty.innerHTML=`<span>${galleryPinnedOnly?'★':'✳'}</span><h2>${query?'No creations found':galleryPinnedOnly?'Your favorites belong here.':'Your next big idea belongs here.'}</h2><p>${query?'Try a different search.':galleryPinnedOnly?'Click Pin on a creation to keep it close.':'Your diagrams autosave here in this browser on this device.'}</p>`;
    $('#boardGrid').append(empty);
  }
  filtered.forEach(b=>{
    const card=document.createElement('article');card.className='board-card'+(b.pinned?' pinned':'');card.tabIndex=0;card.setAttribute('aria-label','Open '+b.title);
    const preview=document.createElement('div');preview.className='board-preview';preview.innerHTML=svgMarkup(b);
    if(b.pinned){const badge=document.createElement('span');badge.className='pin-badge';badge.textContent='★ Pinned';preview.append(badge)}card.append(preview);
    const bottom=document.createElement('div');bottom.className='card-bottom';const title=document.createElement('h3');title.textContent=b.title;bottom.append(title);
    const meta=document.createElement('div');meta.className='card-meta';const date=document.createElement('span');date.textContent=b.nodes.length+(b.nodes.length===1?' element · ':' elements · ')+new Date(b.updated).toLocaleDateString(undefined,{month:'short',day:'numeric'});meta.append(date);
    const actions=document.createElement('div');actions.className='card-actions';
    const pin=document.createElement('button');pin.className='pin-button';pin.textContent=b.pinned?'★ Pinned':'☆ Pin';pin.setAttribute('aria-label',(b.pinned?'Unpin ':'Pin ')+b.title);pin.setAttribute('aria-pressed',String(Boolean(b.pinned)));pin.onclick=event=>{event.stopPropagation();togglePin(b)};actions.append(pin);
    const del=document.createElement('button');del.textContent='Delete';del.setAttribute('aria-label','Delete '+b.title);
    del.onclick=event=>{event.stopPropagation();if(confirm('Delete “'+b.title+'”?')&&persist(boards.filter(x=>x.id!==b.id))){if(board.id===b.id){clearTimeout(autosaveTimer);board={id:crypto.randomUUID(),title:'Untitled diagram',nodes:[],edges:[]};dirty=false;selected.clear();history=[];future=[];$('#boardTitle').value=board.title;writeActiveBoard()}renderGallery();updateButtons();toast('Creation deleted')}};
    actions.append(del);meta.append(actions);bottom.append(meta);card.append(bottom);
    const open=()=>openCreation(b.id);
    card.onclick=open;card.onkeydown=event=>{if(event.key==='Enter'&&event.target===card)open()};$('#boardGrid').append(card);
  });
}
$('#allCreations').onclick=()=>{galleryPinnedOnly=false;renderGallery()};$('#pinnedCreations').onclick=()=>{galleryPinnedOnly=true;renderGallery()};
$('#search').oninput=renderGallery;
function openCreation(id){
  if(dirty&&!save(true))return;
  location.hash='view/'+encodeURIComponent(id);route();
}
function route(){
  if(!location.hash&&boards.some(b=>b.id===board.id))historyReplaceView(board.id);
  const gallery=location.hash==='#boards',viewing=location.hash.startsWith('#view/');
  if((gallery||viewing)&&document.body.classList.contains('editing-fullscreen'))exitEditorFullscreen();
  if((gallery||viewing)&&dirty)save(true);
  document.body.classList.toggle('viewing-creation',viewing);
  $('#editor').classList.toggle('hidden',gallery||viewing);$('#gallery').classList.toggle('hidden',!gallery);$('#viewer').classList.toggle('hidden',!viewing);
  $('#editorLink').classList.toggle('active',!gallery&&!viewing);$('#boardsLink').classList.toggle('active',gallery);$('#pageLabel').textContent=gallery?'My creations':'Diagram studio';
  if(gallery){document.title='My creations — Outline';renderGallery()}
  else if(viewing){
    let id='';try{id=decodeURIComponent(location.hash.slice(6))}catch{}
    const saved=boards.find(b=>b.id===id);
    if(!saved){renderMissingView();return}
    if(board.id!==id){board=JSON.parse(JSON.stringify(saved));dirty=false;selected.clear();history=[];future=[];$('#boardTitle').value=board.title;writeActiveBoard();render()}
    selected.clear();renderResizeBox();renderViewer();requestAnimationFrame(()=>window.scrollTo(0,0));
  }else{document.title='Outline — Diagram studio';render();requestAnimationFrame(fit)}
}
function historyReplaceView(id){window.history.replaceState(null,'','#view/'+encodeURIComponent(id))}
window.addEventListener('hashchange',route);
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select,[contenteditable=true]')||$('#editor').classList.contains('hidden'))return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove()}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?$('#redo').click():$('#undo').click()}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('#save').click()}if(e.key==='Escape'){if(document.body.classList.contains('editing-fullscreen'))exitEditorFullscreen();setTool('select');selected.clear();render();$('#stickerPanel').classList.add('hidden');closeArrange()}});window.addEventListener('beforeunload',e=>{writeActiveBoard();if(dirty&&!save(true)){e.preventDefault();e.returnValue=''}});initializeBoard();render();route();requestAnimationFrame(fit);

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

function initializeBoard(){
  let active=null;try{active=JSON.parse(localStorage.getItem('outline-active-board')||'null')}catch{}
  if(active?.board?.id&&Array.isArray(active.board.nodes)&&Array.isArray(active.board.edges)){
    board=active.board;dirty=Boolean(active.dirty);$('#boardTitle').value=board.title;$('#saveState').textContent=dirty?'Recovered edits · Saving…':'Saved · Autosave on';
    if(dirty)markDirty();
  }else{dirty=false;$('#saveState').textContent='Ready · Autosave on'}
  $('#snap').setAttribute('aria-pressed',String(snapEnabled));$('#snap').textContent=snapEnabled?'Snap on':'Snap off';
}
$('#snap').onclick=()=>{snapEnabled=!snapEnabled;$('#snap').setAttribute('aria-pressed',String(snapEnabled));$('#snap').textContent=snapEnabled?'Snap on':'Snap off';try{localStorage.setItem('outline-snap',String(snapEnabled))}catch{}};
function closeArrange(){$('#arrangePanel').classList.add('hidden');$('#arrange').setAttribute('aria-expanded','false')}
$('#arrange').onclick=()=>{const open=$('#arrangePanel').classList.contains('hidden');$('#arrangePanel').classList.toggle('hidden',!open);$('#arrange').setAttribute('aria-expanded',String(open));updateButtons()};
$('#closeArrange').onclick=closeArrange;
$('#groupSelection').onclick=()=>{
  const nodes=selectedNodes();if(nodes.length<2)return;checkpoint();const id=crypto.randomUUID();nodes.forEach(n=>n.groupId=id);render();toast('Grouped · Click any member to select the group');
};
$('#ungroupSelection').onclick=()=>{const nodes=selectedNodes();if(!nodes.some(n=>n.groupId))return;checkpoint();const groups=new Set(nodes.map(n=>n.groupId).filter(Boolean));board.nodes.forEach(n=>{if(groups.has(n.groupId))delete n.groupId});render();toast('Selection ungrouped')};
function alignSelection(action){
  const units=selectionUnits(),distribute=action.startsWith('distribute');if(units.length<(distribute?3:2))return;
  checkpoint();const left=Math.min(...units.map(u=>u.x)),right=Math.max(...units.map(u=>u.x+u.w)),top=Math.min(...units.map(u=>u.y)),bottom=Math.max(...units.map(u=>u.y+u.h));
  function shift(u,dx,dy){u.nodes.forEach(n=>{n.x+=dx;n.y+=dy})}
  if(distribute){
    const horizontal=action==='distributeX',sorted=units.sort((a,b)=>horizontal?a.x-b.x:a.y-b.y),axis=horizontal?'x':'y',size=horizontal?'w':'h';
    const first=sorted[0],last=sorted.at(-1),available=last[axis]+last[size]-first[axis]-sorted.reduce((sum,u)=>sum+u[size],0),gap=available/(sorted.length-1);
    let position=first[axis];sorted.forEach(u=>{shift(u,horizontal?position-u.x:0,horizontal?0:position-u.y);position+=u[size]+gap});
  }else units.forEach(u=>{let dx=0,dy=0;if(action==='left')dx=left-u.x;if(action==='right')dx=right-u.w-u.x;if(action==='centerX')dx=(left+right-u.w)/2-u.x;if(action==='top')dy=top-u.y;if(action==='bottom')dy=bottom-u.h-u.y;if(action==='centerY')dy=(top+bottom-u.h)/2-u.y;shift(u,dx,dy)});
  render();
}
$$('[data-align]').forEach(button=>button.onclick=()=>alignSelection(button.dataset.align));
function snapMovement(origins,dx,dy,bypass){
  $('#alignGuides')?.remove();if(!snapEnabled||bypass)return {dx,dy};
  const x=Math.min(...origins.map(o=>o.x)),y=Math.min(...origins.map(o=>o.y)),w=Math.max(...origins.map(o=>o.x+o.node.w))-x,h=Math.max(...origins.map(o=>o.y+o.node.h))-y;
  const others=board.nodes.filter(n=>!selected.has(n.id)),limit=6/zoom;let matchX=null,matchY=null;
  for(const n of others){
    for(const target of [n.x,n.x+n.w/2,n.x+n.w])for(const value of [x+dx,x+dx+w/2,x+dx+w]){const delta=target-value;if(Math.abs(delta)<=limit&&(!matchX||Math.abs(delta)<Math.abs(matchX.delta)))matchX={delta,target}}
    for(const target of [n.y,n.y+n.h/2,n.y+n.h])for(const value of [y+dy,y+dy+h/2,y+dy+h]){const delta=target-value;if(Math.abs(delta)<=limit&&(!matchY||Math.abs(delta)<Math.abs(matchY.delta)))matchY={delta,target}}
  }
  dx=matchX?dx+matchX.delta:Math.round((x+dx)/20)*20-x;dy=matchY?dy+matchY.delta:Math.round((y+dy)/20)*20-y;
  if(matchX||matchY){const guides=document.createElement('div');guides.id='alignGuides';for(const [axis,match] of [['x',matchX],['y',matchY]]){if(!match)continue;const line=document.createElement('div');line.className='alignment-guide '+axis;line.style[axis==='x'?'left':'top']=match.target+'px';guides.append(line)}$('#world').append(guides)}
  return {dx,dy};
}

function plannerSvg(n){
  const padding=18,sectionHeight=(n.h-62)/3,font=Math.min(16,n.size),lineHeight=font*1.45;
  let result=`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="${n.color}" stroke="#b3c5a3"/><text x="${n.x+padding}" y="${n.y+34}" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#253a30">${esc(n.text)}</text>`;
  for(const [index,key] of ['morning','afternoon','night'].entries()){
    const y=n.y+55+index*sectionHeight,label=key[0].toUpperCase()+key.slice(1),colors=['#f3f6e9','#fbf3e3','#eeeefa'];
    result+=`<rect x="${n.x+padding}" y="${y}" width="${n.w-padding*2}" height="${sectionHeight-8}" rx="7" fill="${colors[index]}"/><text x="${n.x+padding+12}" y="${y+22}" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="#385642">${label}</text>`;
    const text=n.sections?.[key]||'',maxChars=Math.max(12,Math.floor((n.w-padding*2-24)/(font*.48))),lines=[];
    for(const original of text.split('\n')){let line='';for(const word of original.split(' ')){if((line+' '+word).trim().length>maxChars&&line){lines.push(line);line=word}else line=(line+' '+word).trim()}lines.push(line)}
    const maxLines=Math.max(1,Math.floor((sectionHeight-42)/lineHeight));
    lines.slice(0,maxLines).forEach((line,i)=>{if(i===maxLines-1&&lines.length>maxLines)line+='…';result+=`<text x="${n.x+padding+12}" y="${y+42+i*lineHeight}" font-family="Arial,sans-serif" font-size="${font}" fill="#253a30">${esc(line)}</text>`});
  }
  return result;
}

function renderMissingView(){
  $('#viewTitle').textContent='Creation not found';$('#viewPinned').classList.add('hidden');$('#editCreation').disabled=true;
  $('#viewEyebrow').textContent='YOUR CREATIONS';$('#viewContent').replaceChildren();
  const message=document.createElement('p');message.className='view-missing';message.textContent='This creation is not saved in this browser. Return to My creations to choose another.';$('#viewContent').append(message);updateViewDate();
}
function updateViewDate(){const now=new Date();$('#viewDate').dateTime=now.toISOString();$('#viewDate').textContent=now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}
function renderViewer(){
  const plannersOnly=board.nodes.length>0&&board.nodes.every(n=>n.type==='planner')&&!board.edges.length;
  document.title=board.title+' — Outline';$('#editCreation').disabled=false;$('#viewTitle').textContent=board.title;$('#viewEyebrow').textContent=plannersOnly?'YOUR DAILY SPACE':'YOUR BIGGER PICTURE';$('#viewPinned').classList.toggle('hidden',!board.pinned);updateViewDate();
  const content=$('#viewContent');content.replaceChildren();
  if(!board.nodes.length){const empty=document.createElement('div');empty.className='view-missing';empty.textContent='A little space for your next idea. Choose Edit to add something.';content.append(empty);return}
  if(plannersOnly){
    for(const n of board.nodes){
      const planner=document.createElement('article');planner.className='reminder-planner';
      const heading=document.createElement('h2');heading.textContent=n.text||'My daily routine';planner.append(heading);
      const periods=document.createElement('div');periods.className='reminder-periods';
      for(const [key,label,icon] of [['morning','Morning','🌅'],['afternoon','Afternoon','☀️'],['night','Night','🌙']]){
        const section=document.createElement('section');section.className='reminder-period '+key;
        const iconEl=document.createElement('span');iconEl.className='period-icon';iconEl.textContent=icon;iconEl.setAttribute('aria-hidden','true');section.append(iconEl);
        const title=document.createElement('h3');title.textContent=label;section.append(title);
        const lines=(n.sections?.[key]||'').split('\n').filter(line=>line.trim());
        if(lines.length){const list=document.createElement('ul');lines.forEach(line=>{const item=document.createElement('li');item.textContent=line.replace(/^\s*[•*−–-]\s*/,'');list.append(item)});section.append(list)}
        else{const empty=document.createElement('p');empty.className='period-empty';empty.textContent='A little breathing room.';section.append(empty)}
        periods.append(section);
      }
      planner.append(periods);content.append(planner);
    }
    return;
  }
  const stage=document.createElement('div');stage.id='viewCanvas';stage.className='view-canvas';stage.setAttribute('aria-label','Read-only diagram');
  const world=document.createElement('div');world.id='viewWorld';world.className='readonly-world';
  const edges=document.createElementNS('http://www.w3.org/2000/svg','svg');edges.setAttribute('width','2400');edges.setAttribute('height','1600');edges.classList.add('view-edges');
  edges.innerHTML='<defs><marker id="viewArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8c9690"/></marker></defs>';
  board.edges.forEach(edge=>{const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',edgePath(edge));path.setAttribute('fill','none');path.setAttribute('stroke','#8c9690');path.setAttribute('stroke-width','1.6');path.setAttribute('marker-end','url(#viewArrow)');edges.append(path)});world.append(edges);
  viewNodes=board.nodes.map(n=>({...n}));
  viewNodes.forEach(n=>{
    const el=document.createElement('div');el.className='node '+n.type;el.dataset.viewNode=n.id;Object.assign(el.style,{left:n.x+'px',top:n.y+'px',width:n.w+'px',height:n.h+'px',background:n.color,fontSize:n.size+'px'});
    if(n.type==='planner'){
      el.style.height='auto';el.style.minHeight=n.h+'px';
      const heading=document.createElement('div');heading.className='planner-heading';heading.textContent=n.text;el.append(heading);
      for(const key of ['morning','afternoon','night']){const part=document.createElement('div');part.className='planner-section '+key;const title=document.createElement('strong');title.textContent=key[0].toUpperCase()+key.slice(1);part.append(title);const text=document.createElement('div');text.className='planner-read-text';text.textContent=n.sections?.[key]||'';part.append(text);el.append(part)}
    }else if(n.type==='emoji')el.textContent=n.text;
    else{
      el.style.height='auto';el.style.minHeight=n.h+'px';
      const text=document.createElement('span');text.className='readonly-node-text';text.textContent=n.text;el.append(text);
      if(n.type==='diamond'||n.type==='circle'){const padding=n.w*(n.type==='diamond'?.25:.2);el.style.paddingLeft=padding+'px';el.style.paddingRight=padding+'px'}
    }
    world.append(el);
  });
  stage.append(world);const controls=document.createElement('div');controls.className='view-zoom';
  for(const [label,text,action] of [['Zoom out diagram','−',()=>zoomView(viewZoom/1.2)],['Fit diagram','Fit',fitView],['Zoom in diagram','+',()=>zoomView(viewZoom*1.2)]]){const button=document.createElement('button');button.setAttribute('aria-label',label);button.textContent=text;button.onclick=action;controls.append(button)}
  content.append(stage);content.append(controls);requestAnimationFrame(()=>{expandViewContent();fitView()});
  stage.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.pointerType==='touch'||event.target.closest('button,.planner-read-text'))return;
    const start={x:event.clientX,y:event.clientY,px:viewPan.x,py:viewPan.y};let moved=false;
    const move=e=>{if(e.pointerId!==event.pointerId)return;if(Math.abs(e.clientX-start.x)+Math.abs(e.clientY-start.y)<3&&!moved)return;moved=true;viewPan={x:start.px+e.clientX-start.x,y:start.py+e.clientY-start.y};transformView()};
    const end=e=>{if(e.pointerId!==event.pointerId)return;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end)};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
  });
}
function transformView(){const world=$('#viewWorld');if(world)world.style.transform=`translate(${viewPan.x}px,${viewPan.y}px) scale(${viewZoom})`}
function layoutView(){
  const stage=$('#viewCanvas');if(!stage||$('#viewer').classList.contains('hidden'))return;
  const b=viewBounds(),width=stage.getBoundingClientRect().width;
  stage.style.height=Math.ceil(b.h*viewZoom+32)+'px';
  viewPan={x:(width-b.w*viewZoom)/2-b.x*viewZoom,y:16-b.y*viewZoom};transformView();
}
function fitView(){const stage=$('#viewCanvas');if(!stage||$('#viewer').classList.contains('hidden'))return;viewZoom=Math.max(.1,Math.min(1.4,(stage.getBoundingClientRect().width-24)/viewBounds().w));layoutView()}
function zoomView(value){viewZoom=Math.max(.1,Math.min(3,value));layoutView()}
$('#editCreation').onclick=()=>{location.hash='editor';route();setEditorFullscreen(true)};
$('#doneEditing').onclick=()=>{if(save(true))openCreation(board.id)};
window.addEventListener('resize',()=>requestAnimationFrame(fitView));
setInterval(()=>{if(document.body.classList.contains('viewing-creation'))updateViewDate()},60000);

function viewBounds(){
  if(!viewNodes.length)return bounds();
  const x=Math.min(...viewNodes.map(n=>n.x))-40,y=Math.min(...viewNodes.map(n=>n.y))-40;
  return {x,y,w:Math.max(...viewNodes.map(n=>n.x+n.w))-x+40,h:Math.max(...viewNodes.map(n=>n.y+n.h))-y+40};
}
function expandViewContent(){
  const world=$('#viewWorld');if(!world)return;
  const savedHeights=new Map(viewNodes.map(n=>[n.id,n.h]));
  for(const n of viewNodes){
    if(n.type==='emoji')continue;
    const el=world.querySelector(`[data-view-node="${n.id}"]`);if(!el)continue;
    n.h=Math.max(n.h,el.offsetHeight);
    if(n.type==='diamond'||n.type==='circle'){const text=el.querySelector('.readonly-node-text');if(text)n.h=Math.max(n.h,Math.ceil(text.offsetHeight*(n.type==='diamond'?2:1.6)+32))}
    el.style.height=n.h+'px';
  }
  // Expanded text components push lower items down only in the reading layout.
  const expandingNodes=viewNodes.filter(n=>n.type!=='emoji').sort((a,b)=>a.y-b.y);
  for(const p of expandingNodes){const oldHeight=savedHeights.get(p.id),growth=p.h-oldHeight;if(growth<=0)continue;
    for(const n of viewNodes){if(n.id!==p.id&&n.y>=p.y+oldHeight-1&&n.x<p.x+p.w&&n.x+n.w>p.x)n.y+=growth}
  }
  for(const n of viewNodes){const el=world.querySelector(`[data-view-node="${n.id}"]`);if(el)el.style.top=n.y+'px'}
  const paths=world.querySelectorAll('.view-edges>path');board.edges.forEach((edge,index)=>paths[index]?.setAttribute('d',edgePath(edge,viewNodes)));
}
