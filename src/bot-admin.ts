import { responseSettingsBody, responseSettingsStyle, responseSettingsScript } from './response-settings-admin.js';
export const botManagementStyle = responseSettingsStyle + `
#bot-management-panel{padding-top:20px}#bot-management-panel>.bot-heading{margin:0 5% 16px}#bot-settings-panel{padding:0 5% 24px;color:#163249}#bot-settings-panel .bot-settings-card{background:white;border:1px solid #d8e3eb;border-radius:12px;padding:20px;margin-bottom:16px;min-width:0}#bot-settings-panel .bot-settings-status{background:#fff4d8;padding:14px;border-radius:8px}#bot-settings-panel .bot-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}#bot-settings-panel h3{margin-top:0}#bot-settings-panel dl{display:grid;grid-template-columns:minmax(90px,1fr) minmax(0,2fr);gap:10px}#bot-settings-panel dt{font-weight:700}#bot-settings-panel dd{margin:0;overflow-wrap:anywhere}#bot-settings-panel li{margin-bottom:8px}#bot-settings-panel .bot-settings-note{color:#496379;font-size:.94rem}@media(max-width:760px){#bot-settings-panel .bot-settings-grid{grid-template-columns:1fr}#bot-settings-panel dl{grid-template-columns:1fr}#bot-settings-panel dd{margin-bottom:10px}}
`;
export function botManagementBody(knowledgeBody: string) {
  return `<section id="bot-management-panel" role="region" aria-labelledby="tab-knowledge" hidden>
<div class="bot-heading"><h2>จัดการบอต</h2><p>ดูแลความรู้และการตอบของซีบอต</p></div>
<section id="bot-settings-panel" aria-labelledby="bot-settings-title">${responseSettingsBody}</section>
<section id="knowledge-panel" aria-labelledby="km-heading">${knowledgeBody}</section></section>`;
}
export function botSettingsScript() { return responseSettingsScript; }
export const adminNavigationScript = String.raw`(()=>{
const tabs=['overview','monitor','customers','requests','news','knowledge'].filter(t=>!document.getElementById('tab-'+t).hidden);
function select(name){for(const t of tabs){const active=t===name,b=document.getElementById('tab-'+t);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;document.getElementById(t==='knowledge'?'bot-management-panel':t+'-panel').hidden=!active}}
function fromHash(){const name=location.hash.slice(1);select((name==='bot'||name==='bot-settings'||name==='settings'||name.startsWith('settings-')||name==='knowledge')&&tabs.includes('knowledge')?'knowledge':tabs.includes(name)?name:'overview')}
for(const t of tabs){const b=document.getElementById('tab-'+t);b.onclick=()=>{location.hash=t==='knowledge'?'bot':t;fromHash()};b.onkeydown=e=>{let target;const i=tabs.indexOf(t);if(e.key==='ArrowLeft')target=tabs[(i+tabs.length-1)%tabs.length];if(e.key==='ArrowRight')target=tabs[(i+1)%tabs.length];if(e.key==='Home')target=tabs[0];if(e.key==='End')target=tabs.at(-1);if(target){e.preventDefault();location.hash=target==='knowledge'?'bot':target;fromHash();document.getElementById('tab-'+target).focus()}}}
window.addEventListener('admin-open-customer',()=>{location.hash='customers';fromHash()});window.addEventListener('admin-open-conversation',()=>{location.hash='monitor';fromHash()});window.addEventListener('hashchange',fromHash);fromHash();
})();`;
