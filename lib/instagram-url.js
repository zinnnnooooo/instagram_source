export function validateInstagramUrl(input) {
    if (typeof input !== 'string' || input.length > 2048)
        throw new Error('INVALID_URL');
    let u;
    try {
        u = new URL(input.trim());
    }
    catch {
        throw new Error('INVALID_URL');
    }
    if (u.protocol !== 'https:' || !['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(u.hostname) || u.username || u.password || u.port)
        throw new Error('INVALID_URL');
    const m = u.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,64})\/?$/);
    if (!m)
        throw new Error('INVALID_URL');
    return { shortcode: m[2], url: `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/` };
}
export function isMediaUrl(value) { try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && ['cdninstagram.com', 'fbcdn.net'].some(d => u.hostname.endsWith('.' + d));
}
catch {
    return false;
} }
