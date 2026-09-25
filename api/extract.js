import { extractInstagram, ExtractionError, boundedBody } from '../lib/instagram.js';
export async function POST(request) {
    try {
        const origin = request.headers.get('origin');
        if (origin && origin !== new URL(request.url).origin)
            return Response.json({ code: 'FORBIDDEN', message: '같은 사이트에서 요청해 주세요.' }, { status: 403 });
        const bytes = await boundedBody(new Response(request.body), 4096);
        let body;
        try {
            body = JSON.parse(new TextDecoder().decode(bytes));
        }
        catch {
            return Response.json({ code: 'INVALID_URL', message: '올바른 게시물 링크를 입력해 주세요.' }, { status: 400 });
        }
        const result = await extractInstagram(body?.url);
        return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (e) {
        if (e instanceof ExtractionError)
            return Response.json({ code: e.code, message: e.message }, { status: e.status, headers: { 'Cache-Control': 'no-store' } });
        return Response.json({ code: 'EXTRACTION_FAILED', message: '게시물을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
    }
}
