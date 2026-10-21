// Node-only application smoke test. This DOM shim cannot validate browser layout or Safari events.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const script=html.split('<script>')[1].split('</script>')[0];new Function(script);
assert.ok(!html.includes('此項目目前提供說明，尚未模擬效果。'));
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.style={};this.listeners={};this.value='';this.width=320;this.height=240;this.checked=false;this.className='';this.textContent='';this.classList={add:n=>{this.className+=' '+n},remove:n=>{this.className=this.className.split(' ').filter(x=>x!==n).join(' ')},contains:n=>this.className.split(' ').includes(n),toggle:(n,v)=>{v=v??!this.classList.contains(n);v?this.classList.add(n):this.classList.remove(n)}}}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=nodes}
 setAttribute(k,v){this.attributes[k]=String(v)}
 getAttribute(k){return this.attributes[k]}
 get firstElementChild(){return this.children[0]}
 set innerHTML(s){this.children=[...s.matchAll(/<span/g)].map(()=>new Element('span'))}
 addEventListener(k,fn){this.listeners[k]=fn}
 getBoundingClientRect(){return{x:0,y:0,left:0,top:0,width:320,height:240}}
 getContext(){return ctx}
 setPointerCapture(){}
 toDataURL(){return 'data:image/png;base64,TEST'}
 click(){this.onclick?.()}
}
let log=[];const ctx={globalAlpha:1,fillStyle:'',save(){},restore(){},translate(x,y){log.push(['xy',x,y,this.globalAlpha])},rotate(){},beginPath(){},ellipse(x,y,rx,ry){log.push(['size',rx,ry])},fill(){},clearRect(){log=[]},fillRect(){},setTransform(){}};
const nodes=new Map();for(const [,id]of html.matchAll(/id="([^"]+)"/g))nodes.set(id,new Element(id==='canvas'?'canvas':'div'));
const raf=[];const sandbox={console,performance:{now:()=>100},devicePixelRatio:1,matchMedia:()=>({matches:true}),localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame:fn=>raf.push(fn),window:{addEventListener(){}},document:{getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),createElementNS:(ns,tag)=>new Element(tag),createTextNode:s=>({textContent:s}),body:new Element('body')}};
vm.createContext(sandbox);vm.runInContext(script,sandbox);const run=s=>vm.runInContext(s,sandbox),$=id=>nodes.get(id);
assert.equal($('categories').children.length,14);assert.equal($('previewToggle').getAttribute('aria-expanded'),'false');
let total=0,diagrams=0;
function all(el){return [el,...(el.children||[]).flatMap(all)]}
for(let c=0;c<14;c++){
 $('menuSwitch').checked=true;$('categories').children[c].click();assert.equal($('menuSwitch').checked,false);
 const count=$('items').children.length;
 for(let i=0;i<count;i++){
  $('items').children[i].children[0].click();const item=$('items').children[i];assert.equal(item.children[0].getAttribute('aria-expanded'),'true');
  const body=item.children[1],els=all(body);assert.ok(els.filter(e=>e.tagName==='p'&&e.textContent.length>0).length>=(c===0?4:5),`short lesson ${c}:${i}`);
  assert.ok(els.some(e=>e.tagName==='figure'),`missing comparison ${c}:${i}`);diagrams+=els.filter(e=>e.tagName==='svg').length;
  const ranges=els.filter(e=>e.tagName==='input');for(const range of ranges){range.value='45';range.oninput();assert.ok($('activeSetting').textContent.includes('45'))}
  $('items').children[i].children[0].click();assert.equal($('items').children[i].children.length,1);total++;
 }
 assert.equal($('previewToggle').getAttribute('aria-expanded'),'false');
}
assert.equal(total,141);
// Repeated collapse must leave the drawing state and backing canvas unchanged.
$('previewToggle').click();while(raf.length)raf.shift()();
const canvas=$('canvas');canvas.listeners.pointerdown({button:0,pointerId:1,clientX:10,clientY:40,pressure:.5});canvas.listeners.pointermove({pointerId:1,clientX:250,clientY:70,pressure:.5});canvas.listeners.pointerup({pointerId:1});
assert.equal(run('strokes.length'),1);let stored=run('JSON.stringify(strokes)');const width=canvas.width,height=canvas.height;
$('previewToggle').click();run('resize()');$('previewToggle').click();while(raf.length)raf.shift()();assert.equal(run('JSON.stringify(strokes)'),stored);assert.equal(canvas.width,width);assert.equal(canvas.height,height);
$('undo').click();assert.equal(run('strokes.length'),0);$('redo').click();assert.equal(run('strokes.length'),1);
$('search').value='稀釋';$('search').oninput();assert.equal(run('category'),6);assert.equal($('items').children.length,1);
$('mobileLang').click();assert.equal(run('lang'),'en');$('mobileLang').click();assert.equal(run('lang'),'zh');$('mobileTheme').click();assert.equal(sandbox.document.body.classList.contains('dark'),true);
$('presets').children[0].click();assert.equal(run('settings.spacing'),9);$('exportMobile').click();$('clear').click();assert.equal(run('strokes.length'),0);
function render(cfg,dense=false){log=[];run(`stroke({settings:{...defaults,...${JSON.stringify(cfg)}},size:18,color:'#567e66',seed:42,points:${dense?"Array.from({length:25},(_,i)=>({x:30+i*10,y:90,p:.5,t:i*10}))":"[{x:30,y:90,p:.5,t:0},{x:270,y:90,p:.5,t:240}]"}})`);return JSON.stringify(log)}
assert.equal(render({spacing:70}),render({spacing:70},true),'event density must not change a constant-speed straight stroke');
for(const key of ['spacing','spacingJitter','lateral','linear','falloff','sizeJitter','opacityJitter'])assert.notEqual(render({spacing:70,[key]:0}),render({spacing:70,[key]:90}),key);
assert.ok(run('speedFactor(100,1)<speedFactor(100,0)'));assert.ok(run('speedFactor(-100,1)>speedFactor(-100,0)'));
assert.equal(run('supported.count'),undefined,'opaque overlapping circles must not expose an ineffective count slider');
console.log(`PASS: ${total} lessons expand/collapse with detailed text and comparisons; ${diagrams} conceptual SVG diagrams; all visible parameter sliders; menu, preview-state preservation, draw, undo/redo, search, language, theme, presets, clear and export handler. Renderer effects, speed sign and event-density checks passed. Browser layout and real download not covered.`);
