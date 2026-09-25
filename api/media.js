import { isMediaUrl } from '../lib/instagram-url.js';
export async function GET(request) {
    const url = new URL(request.url).searchParams.get('url') || '';
    if (url.length > 8192 || !isMediaUrl(url))
        return Response.json({ message: '허용되지 않은 미디어 주소입니다.' }, { status: 400 });
    const range = request.headers.get('range');
    if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))
        return Response.json({ message: '지원하지 않는 범위 요청입니다.' }, { status: 416 });
    try {
        const headers = { Accept: 'image/jpeg,image/png,image/webp,video/mp4', Referer: 'https://www.instagram.com/' };
        if (range)
            headers.Range = range;
        const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.any([request.signal, AbortSignal.timeout(90000)]), headers });
        if (response.status === 416) {
            const h = new Headers();
            const cr = response.headers.get('content-range');
            if (cr)
                h.set('Content-Range', cr);
            return new Response(null, { status: 416, headers: h });
        }
        if (!response.ok || !response.body)
            return Response.json({ message: '미디어 링크가 만료되었거나 접근이 제한되었어요. 게시물을 다시 분석해 주세요.' }, { status: 502 });
        const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
        if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(type)) {
            await response.body.cancel();
            return Response.json({ message: '지원하지 않는 미디어 형식입니다.' }, { status: 415 });
        }
        const maxBytes = (type === 'video/mp4' ? 80 : 15) * 1024 * 1024;
        const contentRange = response.headers.get('content-range');
        const total = contentRange?.match(/\/(\d+)$/)?.[1];
        if (Number(response.headers.get('content-length')) > maxBytes || Number(total) > maxBytes) {
            await response.body.cancel();
            return Response.json({ message: type === 'video/mp4' ? '영상이 80MB를 초과해요.' : '사진이 15MB를 초과해요.' }, { status: 413 });
        }
        let received = 0;
        const stream = response.body.pipeThrough(new TransformStream({ transform(chunk, controller) { received += chunk.byteLength; if (received > maxBytes) {
                controller.error(new Error('Media size limit exceeded'));
                return;
            } controller.enqueue(chunk); } }));
        const out = new Headers({ 'Content-Type': type, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
        for (const name of ['content-length', 'content-range', 'accept-ranges']) {
            const value = response.headers.get(name);
            if (value)
                out.set(name, value);
        }
        return new Response(stream, { status: response.status, headers: out });
    }
    catch {
        return Response.json({ message: '미디어를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
    }
}
