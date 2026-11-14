import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const compiled=ts.transpileModule(fs.readFileSync('src/app/application-packages/payment-controls.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function harness(canModify=true){
 const state={environment:'test',version:7,can_modify:canModify,switches:Object.fromEntries(['checkout','recurring','refunds'].map(k=>[k,{enabled:false,effective:false,blockers:[]}]))};
 const slots=[];let cursor=0,effects=[],tree;const calls=[];
 const same=(a,b)=>a&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={useState(v){const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef(v){const i=cursor++;return slots[i]??={current:v};},useCallback(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={fn,deps};return slots[i].fn;},useEffect(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))effects.push(()=>{slots[i]={deps,cleanup:fn()};});}};
 const exports={};const jsx=(type,props)=>({type,props});
 vm.runInNewContext(compiled,{exports,window:{addEventListener(){},removeEventListener(){}},document:{hidden:false},require(name){if(name==='react')return hooks;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(name==='@/lib/api')return{admin:{getPaymentOperations:async()=>structuredClone(state),getPaymentOperationAudit:async()=>({events:[]}),updatePaymentOperations:async(...args)=>{calls.push(args);throw {status:409,detail:'Fixture prerequisite missing'};}}};if(name==='@/lib/auth')return{getAccessToken:()=> 'fixture'};if(name==='@/lib/utils')return{getApiErrorDetail:e=>e.detail,getApiErrorStatus:e=>e.status};if(name.endsWith('/button'))return{Button:'Button'};if(name.endsWith('/card'))return{Card:'Card',CardContent:'CardContent',CardHeader:'CardHeader',CardTitle:'CardTitle'};throw Error(name);}});
 const render=()=>{cursor=0;effects=[];tree=exports.default({canModify});effects.forEach(fn=>fn());return tree;};return{state,calls,render,tree:()=>tree,settle:async()=>{await new Promise(r=>setImmediate(r));return render();}};
}
function nodes(n){if(Array.isArray(n))return n.flatMap(nodes);if(!n||typeof n!=='object')return[];return[n,...nodes(n.props?.children)];}
function text(n){if(Array.isArray(n))return n.map(text).join(' ');if(n==null||typeof n==='boolean')return'';if(typeof n!=='object')return String(n);return text(n.props?.children);}
const button=(h,label)=>nodes(h.tree()).find(n=>n.type==='Button'&&text(n)===label);
test('ordinary admin sees disabled operation switches',async()=>{const h=harness(false);h.render();await h.settle();const switches=nodes(h.tree()).filter(n=>n.props?.role==='switch');assert.equal(switches.length,3);assert.ok(switches.every(n=>n.props.disabled));assert.equal(h.calls.length,0);});
test('confirmation preserves reviewed version and intended state despite refresh',async()=>{const h=harness();h.render();await h.settle();nodes(h.tree()).find(n=>n.props?.role==='switch').props.onClick();h.render();assert.equal(button(h,'Confirm change').props.disabled,true);nodes(h.tree()).find(n=>n.type==='textarea').props.onChange({target:{value:'Fixture reason'}});h.render();h.state.version=8;h.state.switches.checkout.enabled=true;await button(h,'Refresh controls').props.onClick();await h.settle();await button(h,'Confirm change').props.onClick();await h.settle();assert.equal(h.calls[0][0],7);assert.equal(h.calls[0][1].checkout,true);assert.match(text(h.tree()),/Fixture prerequisite missing/);});


test('partial checkpoint exposes refund status only, without execution mutation', () => {
  const source = fs.readFileSync('src/app/application-packages/refund-execution.tsx', 'utf8');
  assert.match(source, /Refund execution is unavailable in this build/);
  assert.match(source, /sandbox execution endpoint is pending approval/);
  assert.match(source, /getApplicationRefundExecution/);
  assert.doesNotMatch(source, /executeApplicationRefund|Execute authorized refund|Confirm refund/);
  assert.doesNotMatch(fs.readFileSync('src/lib/api.ts', 'utf8'), /executeApplicationRefund:/);
});
