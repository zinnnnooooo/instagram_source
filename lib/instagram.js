import { isMediaUrl, validateInstagramUrl } from './instagram-url.js';
export class ExtractionError extends Error {
    code;
    status;
    constructor(code, message, status = 422) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
const messages = { VIDEO_UNAVAILABLE: 'Instagram이 다운로드 가능한 MP4 주소를 제공하지 않았어요. 접근이 제한되었거나 지원하지 않는 영상 형식일 수 있어요.', INVALID_URL: 'Instagram 게시물 링크를 다시 확인해 주세요.', PRIVATE_POST: '비공개 게시물은 추출할 수 없어요. 공개 게시물의 링크를 입력해 주세요.', NOT_FOUND: '게시물을 찾을 수 없어요. 삭제되었거나 공개되지 않은 게시물일 수 있어요.', UNSUPPORTED: '이 게시물에는 다운로드할 사진이나 MP4 영상이 없어요. 스토리는 지원하지 않아요.', LOGIN_REQUIRED: 'Instagram에서 로그인을 요구하고 있어요. 현재 이 게시물의 미디어를 가져올 수 없어요.', RATE_LIMITED: 'Instagram이 요청을 일시적으로 제한했어요. 잠시 후 다시 시도해 주세요.', ACCESS_RESTRICTED: 'Instagram이 서버의 접근을 제한했어요. 현재 이 게시물을 가져올 수 없어요.', EXTRACTION_FAILED: '게시물의 전체 미디어 정보를 확인하지 못했어요. 링크를 확인하거나 잠시 후 다시 시도해 주세요.', TIMEOUT: 'Instagram 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.' };
export function fail(code, status = 422) { throw new ExtractionError(code, messages[code] || messages.EXTRACTION_FAILED, status); }
function dimension(n) { return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null; }
// Match the requested post before reading media; never include recommendations/profile pictures.
export function shortcodeToMediaId(shortcode) { const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; let id = BigInt(0); for (const c of shortcode)
    id = id * BigInt(64) + BigInt(alphabet.indexOf(c)); return id.toString(); }
export function findPost(value, shortcode, depth = 0) {
    if (depth > 28 || !value || typeof value !== 'object')
        return null;
    const o = value;
    if ((o.shortcode === shortcode || o.code === shortcode || String(o.pk || o.id || '').split('_')[0] === shortcodeToMediaId(shortcode)) && (o.display_url || o.image_versions2 || o.carousel_media || o.edge_sidecar_to_children || o.is_video !== undefined || o.media_type))
        return o;
    for (const v of Object.values(o)) {
        const post = findPost(v, shortcode, depth + 1);
        if (post)
            return post;
    }
    return null;
}
export function normalizePost(post, shortcode) {
    if (post.owner?.is_private === true || post.user?.is_private === true)
        fail('PRIVATE_POST', 403);
    let nodes;
    const sidecar = post.edge_sidecar_to_children;
    if (sidecar) {
        if (!Array.isArray(sidecar.edges) || sidecar.page_info?.has_next_page || Number(sidecar.count) > sidecar.edges.length)
            fail('EXTRACTION_FAILED');
        nodes = sidecar.edges.map((x) => x.node);
    }
    else if (post.media_type === 8 || post.__typename === 'GraphSidecar' || post.carousel_media) {
        if (!Array.isArray(post.carousel_media) || !post.carousel_media.length || Number(post.carousel_media_count) > post.carousel_media.length)
            fail('EXTRACTION_FAILED');
        nodes = post.carousel_media;
    }
    else
        nodes = [post];
    if (nodes.length > 50)
        fail('EXTRACTION_FAILED');
    const media = [];
    for (const node of nodes) {
        if (!node)
            fail('EXTRACTION_FAILED');
        const isVideo = node.is_video === true || node.media_type === 2 || node.__typename === 'GraphVideo';
        const candidates = [...(node.image_versions2?.candidates || []), ...(node.display_resources || []).map((x) => ({ url: x.src, width: x.config_width, height: x.config_height }))];
        if (node.display_url)
            candidates.push({ url: node.display_url, width: node.dimensions?.width, height: node.dimensions?.height });
        const best = candidates.filter(c => typeof c.url === 'string' && isMediaUrl(c.url)).sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))[0];
        if (isVideo) {
            const versions = [...(node.video_versions || [])];
            if (node.video_url)
                versions.push({ url: node.video_url, width: node.dimensions?.width, height: node.dimensions?.height });
            const video = versions.filter(v => typeof v.url === 'string' && isMediaUrl(v.url)).sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))[0];
            if (!video)
                fail('VIDEO_UNAVAILABLE');
            media.push({ type: 'video', url: video.url, poster: best?.url, width: dimension(video.width), height: dimension(video.height), duration: dimension(node.video_duration), index: media.length + 1 });
        }
        else {
            if (!best)
                fail('EXTRACTION_FAILED');
            media.push({ type: 'image', url: best.url, width: dimension(best.width), height: dimension(best.height), index: media.length + 1 });
        }
    }
    if (!media.length)
        fail('UNSUPPORTED');
    return { shortcode, media, images: media.filter(m => m.type === 'image'), skippedVideos: 0 };
}
// Instagram embeds expose JSON in script nodes, sometimes as an escaped JSON string.
// Parse JSON only; never execute third-party scripts.
export function parsePayload(text, shortcode) {
    const inspect = (v) => { const p = findPost(v, shortcode); return p ? normalizePost(p, shortcode) : null; };
    try {
        const result = inspect(JSON.parse(text));
        if (result)
            return result;
    }
    catch (e) {
        if (e instanceof ExtractionError)
            throw e;
    }
    for (const match of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        const script = match[1].trim();
        try {
            const result = inspect(JSON.parse(script));
            if (result)
                return result;
        }
        catch (e) {
            if (e instanceof ExtractionError)
                throw e;
        }
        // Balanced object scan supports _sharedData and __additionalDataLoaded wrappers.
        for (let start = script.indexOf('{'), attempt = 0; start >= 0 && attempt < 12; start = script.indexOf('{', start + 1), attempt++) {
            let depth = 0, inString = false, escape = false;
            for (let end = start; end < script.length; end++) {
                const char = script[end];
                if (inString) {
                    if (escape)
                        escape = false;
                    else if (char === '\\')
                        escape = true;
                    else if (char === '"')
                        inString = false;
                    continue;
                }
                if (char === '"') {
                    inString = true;
                    continue;
                }
                if (char === '{')
                    depth++;
                if (char === '}' && --depth === 0) {
                    try {
                        const result = inspect(JSON.parse(script.slice(start, end + 1)));
                        if (result)
                            return result;
                    }
                    catch (e) {
                        if (e instanceof ExtractionError)
                            throw e;
                    }
                    break;
                }
            }
        }
        // Instagram's embed payload can use "gql_data":"{...}".
        for (const stringMatch of script.matchAll(/"(?:gql_data|data)"\s*:\s*("(?:[^"\\]|\\.)*")/g)) {
            try {
                const result = inspect(JSON.parse(JSON.parse(stringMatch[1])));
                if (result)
                    return result;
            }
            catch (e) {
                if (e instanceof ExtractionError)
                    throw e;
            }
        }
    }
    return null;
}
export async function boundedBody(response, maxBytes) {
    const reader = response.body?.getReader();
    if (!reader)
        throw new ExtractionError('EXTRACTION_FAILED', messages.EXTRACTION_FAILED, 502);
    if (Number(response.headers.get('content-length')) > maxBytes) {
        await reader.cancel();
        throw new ExtractionError('TOO_LARGE', '파일 크기가 허용 범위를 넘었어요.', 413);
    }
    const chunks = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        size += value.length;
        if (size > maxBytes) {
            await reader.cancel();
            throw new ExtractionError('TOO_LARGE', '파일 크기가 허용 범위를 넘었어요.', 413);
        }
        chunks.push(value);
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
        data.set(c, offset);
        offset += c.length;
    }
    return data;
}
export async function extractInstagram(input, fetcher = fetch) {
    let parsed;
    try {
        parsed = validateInstagramUrl(input);
    }
    catch {
        fail('INVALID_URL', 400);
    }
    const { url, shortcode } = parsed;
    // Public embed first, then structured page JSON. No login or restriction bypass.
    const endpoints = [`${url}embed/captioned/`, url];
    let lastCode = 'EXTRACTION_FAILED';
    let lsd = '';
    for (const endpoint of endpoints) {
        try {
            const response = await fetcher(endpoint, { headers: { Accept: 'text/html,application/json', 'User-Agent': 'Mozilla/5.0 (compatible; InstaSave/1.0)' }, redirect: 'manual', signal: AbortSignal.timeout(12000) });
            if (response.status === 429)
                fail('RATE_LIMITED', 429);
            if (response.status === 401)
                fail('LOGIN_REQUIRED', 403);
            if (response.status === 403)
                fail('ACCESS_RESTRICTED', 403);
            if (response.status === 404) {
                lastCode = 'NOT_FOUND';
                continue;
            }
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location') || '';
                if (/login|challenge|checkpoint/.test(location))
                    fail('LOGIN_REQUIRED', 403);
                lastCode = 'ACCESS_RESTRICTED';
                continue;
            }
            if (!response.ok) {
                lastCode = 'EXTRACTION_FAILED';
                continue;
            }
            const text = new TextDecoder().decode(await boundedBody(response, 5 * 1024 * 1024));
            lsd = text.match(/\["LSD",\[\],\{"token":"([^"]+)"/)?.[1] || lsd;
            const result = parsePayload(text, shortcode);
            if (result)
                return result;
            if (/login_required|\/accounts\/login\/|Log in to Instagram/i.test(text))
                lastCode = 'LOGIN_REQUIRED';
            else if (/checkpoint_required|challenge_required|please wait a few minutes/i.test(text))
                lastCode = 'ACCESS_RESTRICTED';
        }
        catch (e) {
            if (e instanceof ExtractionError)
                throw e;
            lastCode = e.name === 'TimeoutError' ? 'TIMEOUT' : 'ACCESS_RESTRICTED';
        }
    }
    // Logged-out metadata query, using the token issued by the public page.
    // A gated response remains an error; no credentials, CAPTCHA or access bypass.
    if (lsd && lastCode === 'EXTRACTION_FAILED') {
        try {
            const response = await fetcher('https://www.instagram.com/api/graphql', { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-FB-LSD': lsd, 'X-FB-Friendly-Name': 'PolarisLoggedOutDesktopWWWPostRootContentQuery', Referer: url }, body: new URLSearchParams({ lsd, doc_id: '27130156389949648', fb_api_caller_class: 'RelayModern', fb_api_req_friendly_name: 'PolarisLoggedOutDesktopWWWPostRootContentQuery', variables: JSON.stringify({ media_id: shortcodeToMediaId(shortcode) }) }) });
            if (response.status === 429)
                fail('RATE_LIMITED', 429);
            if (response.status === 401)
                fail('LOGIN_REQUIRED', 403);
            if (response.status === 403)
                fail('ACCESS_RESTRICTED', 403);
            if (response.ok) {
                const text = new TextDecoder().decode(await boundedBody(response, 5 * 1024 * 1024));
                const result = parsePayload(text.replace(/^for \(;;\);/, ''), shortcode);
                if (result)
                    return result;
                if (/login_required|if_not_gated_logged_out":null/.test(text))
                    lastCode = 'LOGIN_REQUIRED';
            }
        }
        catch (e) {
            if (e instanceof ExtractionError)
                throw e;
            lastCode = e.name === 'TimeoutError' ? 'TIMEOUT' : 'ACCESS_RESTRICTED';
        }
    }
    fail(lastCode, lastCode === 'NOT_FOUND' ? 404 : lastCode === 'TIMEOUT' ? 504 : 422);
}
