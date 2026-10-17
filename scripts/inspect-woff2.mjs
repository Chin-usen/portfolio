import { brotliDecompressSync } from 'node:zlib';

// Inspect untransformed cmap/OS/2 tables, not glyph outlines. WOFF2 directory:
// https://www.w3.org/TR/WOFF2/#table_dir_format
// Cmap formats: https://learn.microsoft.com/en-us/typography/opentype/spec/cmap
export function inspectWoff2(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'wOF2' || bytes.toString('ascii', 4, 8) === 'ttcf')
    throw Error('Expected a single WOFF2 font.');
  if (bytes.readUInt32BE(8) !== bytes.length) throw Error('Invalid WOFF2 length.');
  let cursor = 48;
  function base128() {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = bytes.readUInt8(cursor++);
      if ((i === 0 && byte === 0x80) || value > 0x1ffffff)
        throw Error('Invalid WOFF2 base128 integer.');
      value = value * 128 + (byte & 127);
      if (!(byte & 128)) return value;
    }
    throw Error('Invalid WOFF2 base128 integer.');
  }
  const tables = [];
  let length = 0;
  for (let i = 0; i < bytes.readUInt16BE(12); i++) {
    const flags = bytes.readUInt8(cursor++);
    const index = flags & 63;
    const tag = index === 63 ? bytes.toString('ascii', cursor, (cursor += 4)) : index;
    const originalLength = base128();
    const transformed = index === 10 || index === 11 ? flags >> 6 !== 3 : flags >> 6 !== 0;
    const storedLength = transformed ? base128() : originalLength;
    tables.push({ tag, offset: length, length: storedLength, transformed });
    length += storedLength;
  }
  if (length > 64 * 1024 * 1024) throw Error('Font table stream exceeds review limit.');
  const stream = brotliDecompressSync(bytes.subarray(cursor, cursor + bytes.readUInt32BE(20)), {
    maxOutputLength: 64 * 1024 * 1024,
  });
  if (stream.length !== length) throw Error('Invalid WOFF2 table stream length.');
  function table(index, tag) {
    const entry = tables.find((item) => item.tag === index || item.tag === tag);
    if (!entry || entry.transformed) throw Error(`Missing untransformed ${tag} table.`);
    return stream.subarray(entry.offset, entry.offset + entry.length);
  }
  const cmap = table(0, 'cmap');
  const codes = new Set();
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const record = 4 + i * 8;
    const platform = cmap.readUInt16BE(record);
    const encoding = cmap.readUInt16BE(record + 2);
    if (platform !== 0 && !(platform === 3 && [1, 10].includes(encoding))) continue;
    const offset = cmap.readUInt32BE(record + 4);
    const format = cmap.readUInt16BE(offset);
    // Format 14 is a variation-sequence supplement, not the base cmap.
    if (format === 14 && platform === 0 && encoding === 5) continue;
    if (format === 4) {
      const count = cmap.readUInt16BE(offset + 6) / 2;
      for (let segment = 0; segment < count; segment++) {
        const end = cmap.readUInt16BE(offset + 14 + segment * 2);
        const start = cmap.readUInt16BE(offset + 16 + count * 2 + segment * 2);
        const delta = cmap.readInt16BE(offset + 16 + count * 4 + segment * 2);
        const rangeOffset = offset + 16 + count * 6 + segment * 2;
        const range = cmap.readUInt16BE(rangeOffset);
        for (let code = start; code <= end && code < 0xffff; code++) {
          let glyph = range ? cmap.readUInt16BE(rangeOffset + range + (code - start) * 2) : code;
          if (!range || glyph) glyph = (glyph + delta) & 0xffff;
          if (glyph) codes.add(code);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(offset + 12);
      for (let group = 0; group < groups; group++) {
        const at = offset + 16 + group * 12;
        const start = cmap.readUInt32BE(at);
        const end = cmap.readUInt32BE(at + 4);
        const glyph = cmap.readUInt32BE(at + 8);
        if (end > 0x10ffff || start > end) throw Error('Invalid cmap range.');
        for (let code = start; code <= end; code++) if (glyph + code - start) codes.add(code);
      }
    } else throw Error(`Unreviewed Unicode cmap format ${format}.`);
  }
  if (!codes.size) throw Error('Empty Unicode cmap.');
  return { codes, weight: table(6, 'OS/2').readUInt16BE(4) };
}
