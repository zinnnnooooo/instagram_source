import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fontStyles,convertFont} from '../lib/fonts.js';
test('all styles preserve Korean, emoji, punctuation, whitespace and empty input',()=>{
 for(const style of fontStyles.filter(s=>s.category!=='frame')){assert.equal(style.convert('한글 ⚽ 😀\n !'),'한글 ⚽ 😀\n !');assert.equal(style.convert(''),'');}
});
test('Unicode legacy exceptions are mapped rather than unassigned codepoints',()=>{
 assert.equal(convertFont('BEFHILMRego','script'),'ℬℰℱℋℐℒℳℛℯℊℴ');
 assert.equal(convertFont('CHIRZ','fraktur'),'ℭℌℑℜℨ');
 assert.equal(convertFont('CHNPQRZ','outline'),'ℂℍℕℙℚℝℤ');
 assert.equal(convertFont('hi','italic'),'ℎ𝑖');
});
test('numbers and alphabets convert correctly',()=>{
 assert.equal(convertFont('Az09','bold'),'𝐀𝐳𝟎𝟗');
 assert.equal(convertFont('Az09','circle'),'Ⓐⓩ⓪⑨');
 assert.equal(convertFont('Az09','square'),'🄰🅉09');
 for(const style of fontStyles.slice(0,16))assert.equal(Array.from(style.convert('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')).length,62);
});

test('72 unique styles, category counts, frames and marks work',()=>{
 assert.equal(fontStyles.length,72);assert.equal(new Set(fontStyles.map(s=>s.id)).size,72);
 assert.equal(fontStyles.filter(s=>s.category==='letter').length,36);
 assert.equal(fontStyles.filter(s=>s.category==='mark').length,12);
 assert.equal(fontStyles.filter(s=>s.category==='frame').length,24);
 assert.equal(convertFont('Ab 한글 👨‍👩‍👦','underline'),'A\u0332b\u0332 한글 👨‍👩‍👦');
 assert.equal(convertFont('한글\n\nHi','frame-star'),'✦ 한글 ✦\n\n✦ Hi ✦');
 assert.equal(convertFont('abc 09','superscript'),'ᵃᵇᶜ ⁰⁹');
 for(const style of fontStyles)assert.equal(style.convert(''),'');
});

test('added letter mappings and alternating styles have distinct outputs',()=>{
 assert.equal(convertFont('AbZ 한글 ⚽ 09','stroke-latin'),'ȺɃƵ 한글 ⚽ 09');
 assert.equal(convertFont('Ab cd','mix-bold-outline'),'𝐀𝕓 𝐜𝕕');
 const styles=fontStyles.filter(s=>s.category==='letter');
 const outputs=styles.map(s=>s.convert('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'));
 assert.equal(new Set(outputs).size,styles.length);
});
