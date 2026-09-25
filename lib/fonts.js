// Unicode 문자 변환: CSS 폰트가 아니라 복사 가능한 문자열을 생성합니다.
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function range(start, count) { return Array.from({length:count},(_,i)=>String.fromCodePoint(start+i)); }
function alphabet(upper, lower, digits, exceptions={}) {
  const targets=[...range(upper,26),...range(lower,26),...(digits?range(digits,10):Array.from('0123456789'))];
  return Object.fromEntries(Array.from(letters,(char,i)=>[char,exceptions[char]||targets[i]]));
}
const maps = [
 ['bold','굵은 세리프',alphabet(0x1D400,0x1D41A,0x1D7CE)],
 ['italic','기울임',alphabet(0x1D434,0x1D44E,null,{h:'ℎ'})],
 ['bold-italic','굵은 기울임',alphabet(0x1D468,0x1D482)],
 ['sans','고딕',alphabet(0x1D5A0,0x1D5BA,0x1D7E2)],
 ['sans-bold','굵은 고딕',alphabet(0x1D5D4,0x1D5EE,0x1D7EC)],
 ['sans-italic','기울어진 고딕',alphabet(0x1D608,0x1D622)],
 ['sans-bold-italic','굵은 기울임 고딕',alphabet(0x1D63C,0x1D656)],
 ['script','필기체',alphabet(0x1D49C,0x1D4B6,null,{B:'ℬ',E:'ℰ',F:'ℱ',H:'ℋ',I:'ℐ',L:'ℒ',M:'ℳ',R:'ℛ',e:'ℯ',g:'ℊ',o:'ℴ'})],
 ['bold-script','굵은 필기체',alphabet(0x1D4D0,0x1D4EA)],
 ['fraktur','블랙레터',alphabet(0x1D504,0x1D51E,null,{C:'ℭ',H:'ℌ',I:'ℑ',R:'ℜ',Z:'ℨ'})],
 ['bold-fraktur','굵은 블랙레터',alphabet(0x1D56C,0x1D586)],
 ['outline','외곽선',alphabet(0x1D538,0x1D552,0x1D7D8,{C:'ℂ',H:'ℍ',N:'ℕ',P:'ℙ',Q:'ℚ',R:'ℝ',Z:'ℤ'})],
 ['mono','타자기',alphabet(0x1D670,0x1D68A,0x1D7F6)],
 ['fullwidth','전각',alphabet(0xFF21,0xFF41,0xFF10)],
 ['circle','원형',alphabet(0x24B6,0x24D0,null,Object.fromEntries(Array.from('0123456789',(c,i)=>[c,i?String.fromCodePoint(0x2460+i-1):'⓪'])))],
 ['square','사각형',Object.fromEntries(Array.from(letters,c=>[c,/[a-z]/i.test(c)?String.fromCodePoint(0x1F130+c.toUpperCase().charCodeAt(0)-65):c]))],
];
export const fontStyles = maps.map(([id,name,map])=>({id,name,category:'letter',convert:text=>Array.from(text,c=>map[c]||c).join('')}));
export function convertFont(text,id) {
 const style=fontStyles.find(style=>style.id===id);
 if(!style)throw new Error('Unknown font style');
 return style.convert(text);
}


// 추가 문자 스타일. 대응 문자가 없는 문자는 원문을 유지합니다.
function add(id,name,category,convert){fontStyles.push({id,name,category,convert});}
function mapped(id,name,source,target){
 const table=Object.fromEntries(Array.from(source,(c,i)=>[c,Array.from(target)[i]||c]));
 add(id,name,'letter',text=>Array.from(text,c=>table[c]||c).join(''));
}
const lower='abcdefghijklmnopqrstuvwxyz';
mapped('smallcaps','스몰캡',lower,'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqʀꜱᴛᴜᴠᴡxʏᴢ');
mapped('superscript','위첨자',lower+'0123456789','ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ⁰¹²³⁴⁵⁶⁷⁸⁹');
mapped('subscript','아래첨자',lower+'0123456789','ₐbcdₑfgₕᵢⱼₖₗₘₙₒₚqᵣₛₜᵤᵥwₓyz₀₁₂₃₄₅₆₇₈₉');
for(const [id,name,start] of [['filled-circle','채워진 원형',0x1F150],['filled-square','채워진 사각형',0x1F170]]){
 add(id,name,'letter',text=>Array.from(text,c=>/^[a-z]$/i.test(c)?String.fromCodePoint(start+c.toUpperCase().charCodeAt(0)-65):c).join(''));
}
add('parenthesized','괄호 문자','letter',text=>Array.from(text,c=>/^[a-z]$/i.test(c)?String.fromCodePoint(0x249C+c.toLowerCase().charCodeAt(0)-97):c).join(''));
const upside=Object.fromEntries(Array.from(lower,(c,i)=>[c,Array.from('ɐqɔpǝɟƃɥıɾʞlɯuodbɹsʇnʌʍxʎz')[i]]));
add('upside','뒤집힌 영문','letter',text=>Array.from(text,c=>upside[c]||c).join(''));
add('spaced','영문 자간 넓게','letter',text=>text.replace(/[A-Za-z0-9]+/g,word=>Array.from(word).join(' ')));

// 문자 스타일 추가: 기존 24종의 매핑과 출력은 변경하지 않습니다.
// 유사 모양 문자 스타일은 다른 라틴 문자·음성 기호 등을 활용한 장식용 변환입니다.
function letterMap(id,name,targets){
 const chars=Array.from(targets);
 if(chars.length!==26)throw new Error(`Invalid alphabet: ${id}`);
 const table=Object.fromEntries(Array.from(lower,(c,i)=>[c,chars[i]]));
 add(id,name,'letter',text=>Array.from(text,c=>/^[A-Za-z]$/.test(c)?table[c.toLowerCase()]:c).join(''));
}
letterMap('hooked','후크 레터','ค๒ƈɗɛʄɠɦɨʝƙʟɱɳσρզɾʂƭυѵωҳყʐ');
letterMap('stroke-latin','스트로크 레터','ȺɃȻĐɆƑǤĦƗɈꝀŁMꞤØⱣꝖɌSŦɄVⱲXɎƵ');
letterMap('curved','커브 레터','ɑɓƈɗҽƒɠɦɨʝƙʅɱɳօƥզɾʂƚʋʌɯҳყʑ');
letterMap('wide-smallcaps','와이드 스몰캡','ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘꞯʀꜱᴛᴜᴠᴡxʏᴢ');
letterMap('phonetic','포네틱 레터','ɒʙɔɗəʄɢʜɪʝκʟɱɴɵρʠʀʃƭʊʋɯχʏʐ');
letterMap('angular','앵글 레터','ΛBCDΣFGHIJƘLMИӨPQRƧƬЦVWXƳZ');
// 혼합 서체는 영문 순서대로 교차 적용합니다. 한글·이모지·공백은 보존합니다.
function mixed(id,name,first,second){
 const a=fontStyles.find(style=>style.id===first).convert;
 const b=fontStyles.find(style=>style.id===second).convert;
 add(id,name,'letter',text=>{let index=0;return Array.from(text,c=>/^[A-Za-z]$/.test(c)?(index++%2?b(c):a(c)):c).join('');});
}
mixed('mix-bold-outline','굵은체 × 외곽선','bold','outline');
mixed('mix-script-outline','필기체 × 외곽선','bold-script','outline');
mixed('mix-fraktur-script','블랙레터 × 필기체','bold-fraktur','bold-script');
mixed('mix-serif-italic','세리프 × 기울임','bold','italic');
mixed('mix-sans-mono','고딕 × 타자기','sans-bold','mono');
mixed('mix-circle-square','원형 × 사각형','circle','square');

// 결합 문자는 영문·숫자에만 붙여 한글과 이모지 조합을 보존합니다.
for(const [id,name,mark] of [
 ['underline','밑줄','\u0332'],['double-underline','이중 밑줄','\u0333'],
 ['strike','취소선','\u0336'],['short-strike','짧은 취소선','\u0335'],
 ['slash','사선','\u0338'],['overline','윗줄','\u0305'],
 ['double-overline','이중 윗줄','\u033F'],['dot-top','윗점','\u0307'],
 ['dot-bottom','아랫점','\u0323'],['wave-top','물결 장식','\u0303'],
 ['circle-mark','원 테두리 장식','\u20DD'],['keycap-mark','키캡 장식','\u20E3']
])add(id,name,'mark',text=>text.replace(/[A-Za-z0-9]/g,c=>c+mark));

// 문구 장식은 줄 단위로 적용하며 텍스트 내용은 그대로 유지합니다.
for(const [id,name,left,right] of [
 ['star','별','✦ ',' ✦'],['sparkle','반짝임','✧･ﾟ ',' ･ﾟ✧'],
 ['heart','하트','♡ ',' ♡'],['solid-heart','채워진 하트','♥ ',' ♥'],
 ['flower','꽃','✿ ',' ✿'],['snow','눈꽃','❅ ',' ❅'],
 ['moon','달','☾ ',' ☽'],['sun','햇살','☀ ',' ☀'],
 ['wings','날개','꧁ ',' ꧂'],['ornament','오너먼트','༺ ',' ༻'],
 ['bracket','꺾쇠','《 ',' 》'],['corner','모서리','『 ',' 』'],
 ['square-bracket','대괄호','【 ',' 】'],['angle','화살 괄호','〈 ',' 〉'],
 ['arrow','화살표','➜ ',' ←'],['double-arrow','이중 화살표','» ',' «'],
 ['diamond','다이아몬드','◇ ',' ◇'],['solid-diamond','채워진 다이아몬드','◆ ',' ◆'],
 ['dots','점 장식','•·.· ',' ·.·•'],['wave','물결 프레임','〜 ',' 〜'],
 ['music','음표','♫ ',' ♫'],['crown','왕관','♛ ',' ♛'],
 ['football','풋볼','⚽ ',' ⚽'],['trophy','트로피','🏆 ',' 🏆']
])add('frame-'+id,name+' 프레임','frame',text=>text.split('\n').map(line=>line.trim()?left+line+right:line).join('\n'));
