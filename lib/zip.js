// ZIP STORE: original image bytes, UTF-8 filenames, CRC32, no dependency.
const table = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++)
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(data) { let c = 0xffffffff; for (const b of data)
    c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function createZip(files) {
    const chunks = [];
    const directory = [];
    let offset = 0;
    let dirSize = 0;
    for (const file of files) {
        const name = new TextEncoder().encode(file.name);
        const crc = crc32(file.data);
        const head = new Uint8Array(30 + name.length);
        const h = new DataView(head.buffer);
        h.setUint32(0, 0x04034b50, true);
        h.setUint16(4, 20, true);
        h.setUint16(6, 0x800, true);
        h.setUint16(12, 33, true);
        h.setUint32(14, crc, true);
        h.setUint32(18, file.data.length, true);
        h.setUint32(22, file.data.length, true);
        h.setUint16(26, name.length, true);
        head.set(name, 30);
        chunks.push(head, file.data);
        const dir = new Uint8Array(46 + name.length);
        const d = new DataView(dir.buffer);
        d.setUint32(0, 0x02014b50, true);
        d.setUint16(4, 20, true);
        d.setUint16(6, 20, true);
        d.setUint16(8, 0x800, true);
        d.setUint16(14, 33, true);
        d.setUint32(16, crc, true);
        d.setUint32(20, file.data.length, true);
        d.setUint32(24, file.data.length, true);
        d.setUint16(28, name.length, true);
        d.setUint32(42, offset, true);
        dir.set(name, 46);
        directory.push(dir);
        dirSize += dir.length;
        offset += head.length + file.data.length;
    }
    const end = new Uint8Array(22);
    const e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, dirSize, true);
    e.setUint32(16, offset, true);
    return new Blob([...chunks, ...directory, end], { type: 'application/zip' });
}
