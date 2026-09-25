import { validateInstagramUrl } from './lib/instagram-url.js';
import { createZip } from './lib/zip.js';

// 화면 동작은 이 파일에서 수정합니다. 추출 API는 api/extract.js입니다.
const $ = id => document.getElementById(id);
const input = $('url');
let result = null, extracting = false, controller, downloadController, toastTimer;
const titles = {INVALID_URL:'INVALID INSTAGRAM LINK',PRIVATE_POST:'PRIVATE POST',NOT_FOUND:'POST NOT AVAILABLE',UNSUPPORTED:'NO SUPPORTED MEDIA',VIDEO_UNAVAILABLE:'VIDEO UNAVAILABLE',LOGIN_REQUIRED:'LOGIN REQUIRED',RATE_LIMITED:'PLEASE TRY AGAIN LATER',ACCESS_RESTRICTED:'INSTAGRAM ACCESS RESTRICTED',EXTRACTION_FAILED:'COULDN’T READ THIS POST',TIMEOUT:'TAKING A LITTLE TOO LONG',NETWORK_ERROR:'CONNECTION INTERRUPTED'};
const proxy = url => `/api/media?url=${encodeURIComponent(url)}`;
function notify(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5000);
}
function setState(state) {
  for (const id of ['loading','error','results','resting']) $(id).hidden = id !== state;
  extracting = state === 'loading';
  $('extract').disabled = extracting || !input.value.trim();
  $('url-form').setAttribute('aria-busy', String(extracting));
  input.setAttribute('aria-invalid', 'false');
}
function cancel() {
  controller?.abort(); downloadController?.abort(); downloadController = null;
}
function reset() {
  cancel(); result = null; input.value = ''; $('media-grid').replaceChildren();
  $('toast').hidden = true; setState('resting'); input.focus();
}
async function extract() {
  cancel(); result = null; $('media-grid').replaceChildren();
  try { validateInstagramUrl(input.value); }
  catch {
    setState('error'); input.setAttribute('aria-invalid','true');
    $('error-title').textContent = titles.INVALID_URL;
    $('error-message').textContent = 'Instagram 게시물 또는 릴스 링크를 확인해 주세요.';
    input.focus(); return;
  }
  const c = controller = new AbortController(); setState('loading');
  try {
    const response = await fetch('/api/extract', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:input.value}),signal:c.signal});
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); }
    catch {
      if ([404,405].includes(response.status)) throw new Error('추출 서버가 실행되지 않았어요. Live Server 대신 프로젝트 터미널에서 npm start를 실행하고 http://localhost:3000으로 접속해 주세요.');
      throw new Error(`서버 응답을 읽지 못했어요 (HTTP ${response.status}). 서버 실행 상태를 확인해 주세요.`);
    }
    if (!data || typeof data !== 'object') throw new Error('서버가 올바른 응답을 반환하지 않았어요.');
    if (!response.ok) throw data;
    if (c.signal.aborted) return;
    result = data; renderResults(); setState('results');
  } catch (error) {
    if (c.signal.aborted) return;
    setState('error'); $('error-title').textContent = titles[error.code] || titles.NETWORK_ERROR;
    $('error-message').textContent = error.message || '연결을 확인한 후 다시 시도해 주세요.';
  }
}
function element(tag, className, text) {
  const el = document.createElement(tag); el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function renderResults() {
  $('result-count').textContent = `${result.media.length} MEDIA FOUND`;
  $('media-count').textContent = `사진 ${result.media.filter(m=>m.type==='image').length}개 · 영상 ${result.media.filter(m=>m.type==='video').length}개`;
  $('media-grid').replaceChildren();
  for (const media of result.media) {
    const number = String(media.index).padStart(2,'0');
    const card = element('article','media-card'), frame = element('div','image-frame');
    const preview = document.createElement(media.type==='video'?'video':'img');
    const info = element('div','media-info');
    const resolution = element('div','resolution', media.width&&media.height?`${media.width} × ${media.height}`:'해상도 확인 중');
    if (media.type==='video') {
      preview.controls = true; preview.playsInline = true; preview.preload = 'metadata';
      preview.setAttribute('aria-label',`Instagram 영상 ${media.index}`);
      if (media.poster) preview.poster = proxy(media.poster);
      preview.addEventListener('loadedmetadata',()=>resolution.textContent=`${preview.videoWidth} × ${preview.videoHeight}`);
    } else {
      preview.alt = `추출된 Instagram 사진 ${media.index}`; preview.loading = 'lazy';
      preview.addEventListener('load',()=>resolution.textContent=`${preview.naturalWidth} × ${preview.naturalHeight}`);
    }
    preview.addEventListener('error',()=>preview.replaceWith(element('div','image-failed','미리보기를 불러오지 못했어요. 게시물을 다시 분석해 주세요.')), {once:true});
    preview.src = proxy(media.url);
    frame.append(preview,element('span','image-index',number));
    const button = element('button','download-button',media.type==='video'?'↓ DOWNLOAD MP4':'↓ DOWNLOAD');
    button.dataset.index = String(media.index);
    button.dataset.label = button.textContent;
    button.addEventListener('click',()=>download(media));
    info.append(element('h3','',`${media.type==='video'?'VIDEO':'IMAGE'} ${number}`),resolution,button);
    card.append(frame,info); $('media-grid').append(card);
  }
  downloadState(null);
}
function downloadState(index, progress=0) {
  $('download-all').disabled = index !== null;
  $('download-all').textContent = index===0?`${progress}/${result.media.length} PREPARING…`:'↓ DOWNLOAD ALL · ZIP';
  for (const button of document.querySelectorAll('.download-button')) {
    button.disabled = index !== null;
    button.textContent = index===0||String(index)===button.dataset.index?'DOWNLOADING…':button.dataset.label;
  }
}
async function getMedia(media, signal) {
  const response = await fetch(proxy(media.url), {signal});
  if (!response.ok) {
    const error = await response.json().catch(()=>null);
    throw new Error(error?.message || '다운로드에 실패했어요. 게시물을 다시 분석해 주세요.');
  }
  const blob = await response.blob();
  const extension = blob.type.includes('video/mp4')?'mp4':blob.type.includes('png')?'png':blob.type.includes('webp')?'webp':'jpg';
  return {blob,name:`instagram_${String(media.index).padStart(2,'0')}.${extension}`};
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function download(media) {
  if (!result || downloadController) return;
  const current = result, c = downloadController = new AbortController();
  downloadState(media?media.index:0);
  try {
    if (media) {
      const file = await getMedia(media,c.signal);
      if (c.signal.aborted) return;
      saveBlob(file.blob,file.name);
    } else {
      const files = []; let total = 0;
      for (const item of current.media) {
        const file = await getMedia(item,c.signal); total += file.blob.size;
        if (total>80*1024*1024) throw new Error('전체 미디어가 80MB를 넘어요. 개별 다운로드를 이용해 주세요.');
        files.push({name:file.name,data:new Uint8Array(await file.blob.arrayBuffer())});
        if (c.signal.aborted) return;
        downloadState(0,files.length);
      }
      saveBlob(createZip(files),`instagram_${current.shortcode}.zip`);
    }
    notify('다운로드 파일을 준비했어요. 브라우저의 다운로드를 확인해 주세요.');
  } catch(error) { if(!c.signal.aborted) notify(error.message); }
  finally { if(downloadController===c) { downloadController=null; downloadState(null); } }
}
$('url-form').addEventListener('submit',event=>{event.preventDefault();extract();});
input.addEventListener('input',()=>$('extract').disabled=extracting||!input.value.trim());
$('reset').addEventListener('click',reset);
$('retry').addEventListener('click',extract);
$('download-all').addEventListener('click',()=>download());
$('paste').addEventListener('click',async()=>{
  try {input.value=(await navigator.clipboard.readText()).trim();$('extract').disabled=extracting||!input.value.trim();}
  catch {notify('클립보드를 읽을 수 없어요. 입력창에 직접 붙여넣어 주세요.');}
  input.focus();
});
window.addEventListener('pagehide',cancel);

/* --- Interactive Motion Engine (3D Tilt & Parallax) --- */
(function initVisualInteractions() {
  if (typeof window === 'undefined') return;
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!isFinePointer || prefersReduced) return;

  // 1. URL Input 3D Tilt (Stronger 4-6deg)
  const inputWrap = document.querySelector('.input-wrap');
  if (inputWrap) {
    let inputFrameId = null;
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let isHovered = false;

    function updateInputTilt() {
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;

      if (isHovered || Math.abs(currentX) > 0.005 || Math.abs(currentY) > 0.005) {
        const rotX = -currentY * 5.0;
        const rotY = currentX * 5.0;
        const ty = isHovered ? -4 : 0;
        const sc = isHovered ? 1.02 : 1;
        inputWrap.style.transform = `perspective(800px) translateY(${ty}px) scale(${sc}) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
        inputFrameId = requestAnimationFrame(updateInputTilt);
      } else {
        inputWrap.style.transform = '';
        inputFrameId = null;
      }
    }

    inputWrap.addEventListener('mousemove', (e) => {
      const rect = inputWrap.getBoundingClientRect();
      targetX = (e.clientX - rect.left) / rect.width - 0.5;
      targetY = (e.clientY - rect.top) / rect.height - 0.5;
      if (!inputFrameId) {
        inputFrameId = requestAnimationFrame(updateInputTilt);
      }
    });

    inputWrap.addEventListener('mouseenter', () => {
      isHovered = true;
      if (!inputFrameId) {
        inputFrameId = requestAnimationFrame(updateInputTilt);
      }
    });

    inputWrap.addEventListener('mouseleave', () => {
      isHovered = false;
      targetX = 0;
      targetY = 0;
    });
  }

  // 2. Background Object Parallax
  const shapeConfigs = [
    { selector: '.circle', factorX: 16, factorY: 14 },
    { selector: '.square', factorX: -14, factorY: -12 },
    { selector: '.diamond', factorX: 18, factorY: 15 },
    { selector: '.pink', factorX: -12, factorY: 14 },
    { selector: '.polygon', factorX: 10, factorY: -12 },
    { selector: '.cross', factorX: -16, factorY: 18 },
    { selector: '.dot', factorX: -9, factorY: -8 },
    { selector: '.dots', factorX: 12, factorY: 10 }
  ];

  const shapes = shapeConfigs
    .map(item => ({ el: document.querySelector(item.selector), factorX: item.factorX, factorY: item.factorY }))
    .filter(item => item.el !== null);

  if (shapes.length > 0) {
    let pxTargetX = 0, pxTargetY = 0;
    let pxCurrentX = 0, pxCurrentY = 0;
    let parallaxFrameId = null;

    function updateParallax() {
      pxCurrentX += (pxTargetX - pxCurrentX) * 0.08;
      pxCurrentY += (pxTargetY - pxCurrentY) * 0.08;

      shapes.forEach(item => {
        const x = pxCurrentX * item.factorX;
        const y = pxCurrentY * item.factorY;
        item.el.style.setProperty('--px', `${x.toFixed(2)}px`);
        item.el.style.setProperty('--py', `${y.toFixed(2)}px`);
      });

      if (Math.abs(pxTargetX - pxCurrentX) > 0.001 || Math.abs(pxTargetY - pxCurrentY) > 0.001) {
        parallaxFrameId = requestAnimationFrame(updateParallax);
      } else {
        parallaxFrameId = null;
      }
    }

    window.addEventListener('mousemove', (e) => {
      pxTargetX = (e.clientX / window.innerWidth) - 0.5;
      pxTargetY = (e.clientY / window.innerHeight) - 0.5;
      if (!parallaxFrameId) {
        parallaxFrameId = requestAnimationFrame(updateParallax);
      }
    }, { passive: true });
  }

  // 3. Media Card 3D Tilt Delegate (Stronger)
  const mediaGrid = document.getElementById('media-grid');
  if (mediaGrid) {
    let activeCard = null;
    let cardFrameId = null;
    let cTargetX = 0, cTargetY = 0;
    let cCurrentX = 0, cCurrentY = 0;

    function updateCardTilt() {
      if (!activeCard) {
        cardFrameId = null;
        return;
      }
      cCurrentX += (cTargetX - cCurrentX) * 0.15;
      cCurrentY += (cTargetY - cCurrentY) * 0.15;

      const rotX = -cCurrentY * 4.0;
      const rotY = cCurrentX * 4.0;
      activeCard.style.transform = `perspective(600px) translateY(-8px) scale(1.025) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;

      if (activeCard) {
        cardFrameId = requestAnimationFrame(updateCardTilt);
      }
    }

    mediaGrid.addEventListener('mousemove', (e) => {
      const card = e.target.closest('.media-card');
      if (card) {
        if (activeCard !== card) {
          if (activeCard) activeCard.style.transform = '';
          activeCard = card;
        }
        const rect = card.getBoundingClientRect();
        cTargetX = (e.clientX - rect.left) / rect.width - 0.5;
        cTargetY = (e.clientY - rect.top) / rect.height - 0.5;
        if (!cardFrameId) {
          cardFrameId = requestAnimationFrame(updateCardTilt);
        }
      }
    });

    mediaGrid.addEventListener('mouseleave', () => {
      if (activeCard) {
        activeCard.style.transform = '';
        activeCard = null;
      }
    }, true);
  }

  // 4. Custom Graphic Neo-Brutalism Mouse Cursor System
  (function initCustomCursor() {
    const coreEl = document.createElement('div');
    coreEl.className = 'custom-cursor-core';
    const followerEl = document.createElement('div');
    followerEl.className = 'custom-cursor-follower';
    followerEl.innerHTML = '<div class="cursor-follower-inner"></div>';

    document.body.appendChild(coreEl);
    document.body.appendChild(followerEl);
    document.documentElement.classList.add('cursor-ready');

    let mouseX = -100, mouseY = -100;
    let coreX = -100, coreY = -100;
    let followerX = -100, followerY = -100;
    let isFirstMove = true;
    let currentMode = '';

    function setMode(mode) {
      if (currentMode === mode) return;
      if (currentMode) document.documentElement.classList.remove(currentMode);
      currentMode = mode;
      if (currentMode) document.documentElement.classList.add(currentMode);
    }

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      document.documentElement.classList.remove('cursor-hidden');
      if (isFirstMove) {
        coreX = mouseX;
        coreY = mouseY;
        followerX = mouseX;
        followerY = mouseY;
        isFirstMove = false;
      }
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      document.documentElement.classList.add('cursor-hidden');
    }, { passive: true });

    window.addEventListener('mouseenter', () => {
      document.documentElement.classList.remove('cursor-hidden');
    }, { passive: true });

    window.addEventListener('mousedown', () => {
      document.documentElement.classList.add('cursor-active');
    }, { passive: true });

    window.addEventListener('mouseup', () => {
      document.documentElement.classList.remove('cursor-active');
    }, { passive: true });

    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      if (!t) return;
      if (t.closest('.download-button, #download-all')) {
        setMode('cursor-mode-download');
      } else if (t.closest('button, a, .paste, .extract, .retry, .icon-button')) {
        setMode('cursor-mode-button');
      } else if (t.closest('input, .input-wrap')) {
        setMode('cursor-mode-input');
      } else if (t.closest('.hero, .hero-line, .highlight-word')) {
        setMode('cursor-mode-hero');
      } else if (t.closest('.media-card')) {
        setMode('cursor-mode-media');
      } else if (t.closest('.circle, .pink')) {
        setMode('cursor-mode-pink');
      } else if (t.closest('.diamond, .polygon')) {
        setMode('cursor-mode-purple');
      } else if (t.closest('.square, .sticker')) {
        setMode('cursor-mode-lime');
      } else if (t.closest('.badge')) {
        setMode('cursor-mode-yellow');
      } else if (t.closest('.shape')) {
        setMode('cursor-mode-purple');
      } else {
        setMode('');
      }
    }, { passive: true });

    function renderCursor() {
      if (!isFirstMove) {
        coreX += (mouseX - coreX) * 0.65;
        coreY += (mouseY - coreY) * 0.65;
        followerX += (mouseX - followerX) * 0.28;
        followerY += (mouseY - followerY) * 0.28;

        coreEl.style.transform = `translate3d(${coreX.toFixed(2)}px, ${coreY.toFixed(2)}px, 0)`;
        followerEl.style.transform = `translate3d(${followerX.toFixed(2)}px, ${followerY.toFixed(2)}px, 0)`;
      }
      requestAnimationFrame(renderCursor);
    }
    requestAnimationFrame(renderCursor);
  })();
})();


