import { fontStyles, convertFont } from './lib/fonts.js';
const $=id=>document.getElementById(id);
const tabs=[$('media-tab'),$('fonts-tab')];
const input=$('font-input');
let category='all';
function message(text){$('font-status').textContent=text;}
function activate(tab){
 tabs.forEach(item=>{const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;$(item.getAttribute('aria-controls')).hidden=!selected;});
 if(tab===$('fonts-tab')) document.querySelectorAll('#media-panel video').forEach(video=>video.pause());
 $('reset').setAttribute('aria-label',tab===$('fonts-tab')?'글꼴 입력 초기화':'입력과 결과 초기화');
}
for(const tab of tabs){
 tab.addEventListener('click',()=>activate(tab));
 tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?tabs[0]:e.key==='End'?tabs[1]:tabs[1-tabs.indexOf(tab)];activate(next);next.focus();}});
}
function render(){
 message('');
 const text=input.value, hasText=Boolean(text.trim());
 $('font-length').textContent=`${Array.from(text).length}자`;
 $('font-grid').replaceChildren();
 const visible=fontStyles.filter(style=>category==='all'||style.category===category);
 $('font-style-count').textContent=`${visible.length} / ${fontStyles.length} STYLES`;
 for(const style of visible){
  const card=document.createElement('article');card.className='font-card';
  const label=document.createElement('h3');label.textContent=style.name;
  const preview=document.createElement('p');preview.className='font-preview';preview.dir='auto';preview.textContent=convertFont(hasText?text:'Football Inside',style.id);
  const button=document.createElement('button');button.className='font-copy';button.type='button';button.textContent='복사하기 ↗';button.disabled=!hasText;button.setAttribute('aria-label',`${style.name} 복사하기`);
  button.addEventListener('click',async()=>{
   const value=convertFont(input.value,style.id);if(!value.trim())return;
   try{
    await navigator.clipboard.writeText(value);
    message(`${style.name} 문구를 복사했어요.`);
   }catch{
    $('font-manual').hidden=false;$('font-manual-text').value=value;$('font-manual-text').focus();$('font-manual-text').select();
    message('자동 복사가 제한되어 있어요. 선택된 문구를 Ctrl+C 또는 길게 눌러 복사하세요.');
   }
  });
  card.append(label,preview,button);$('font-grid').append(card);
 }
 $('font-example-note').hidden=hasText;
 $('font-manual').hidden=true;
}
input.addEventListener('input',render);
function resetFonts(){input.value='';render();input.focus();}
$('font-clear').addEventListener('click',resetFonts);
$('reset').addEventListener('click',e=>{if(!$('fonts-panel').hidden){e.stopImmediatePropagation();resetFonts();}},true);
render();

for(const button of document.querySelectorAll('[data-font-category]')){
 button.addEventListener('click',()=>{
  category=button.dataset.fontCategory;
  document.querySelectorAll('[data-font-category]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  render();
 });
}
