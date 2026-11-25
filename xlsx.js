/* Excelファイル（.xlsx）を、外部ライブラリなしで作る。ブラウザでもnodeでも動く */
const Xlsx = (function () {
  const T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const enc = (s) => new TextEncoder().encode(s);
  const concat = (arr) => { const n = arr.reduce((a, x) => a + x.length, 0), o = new Uint8Array(n); let p = 0; arr.forEach((x) => { o.set(x, p); p += x.length; }); return o; };
  function zip(files) {
    const parts = [], cd = []; let off = 0;
    files.forEach((f) => {
      const nm = enc(f.name), c = crc(f.data), sz = f.data.length;
      const h = new Uint8Array(30 + nm.length), v = new DataView(h.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(12, 0x21, true); v.setUint32(14, c, true); v.setUint32(18, sz, true); v.setUint32(22, sz, true); v.setUint16(26, nm.length, true); h.set(nm, 30);
      parts.push(h, f.data);
      const d = new Uint8Array(46 + nm.length), w = new DataView(d.buffer);
      w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x0800, true); w.setUint16(14, 0x21, true); w.setUint32(16, c, true); w.setUint32(20, sz, true); w.setUint32(24, sz, true); w.setUint16(28, nm.length, true); w.setUint32(42, off, true); d.set(nm, 46);
      cd.push(d); off += h.length + sz;
    });
    const size = cd.reduce((a, x) => a + x.length, 0), e = new Uint8Array(22), ev = new DataView(e.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, size, true); ev.setUint32(16, off, true);
    return concat(parts.concat(cd, [e]));
  }
  const esc = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const col = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  // ---- 書式つきのセル：{ v, b, sz, h, va, wrap, bt, bb, bl, br, num } 。文字・数値だけの従来の書き方もそのまま使える ----
  const isCell = (v) => v !== null && typeof v === 'object' && !(v instanceof Date);
  function styleBook() {
    const fonts = [], borders = [], xfs = [], idx = (arr, key) => { let i = arr.indexOf(key); if (i < 0) { arr.push(key); i = arr.length - 1; } return i; };
    idx(fonts, '11|0'); idx(borders, '||||'); xfs.push('0|0|0|||0|0');
    const id = (c) => {
      if (!isCell(c)) return 0;
      const bd = ['bt', 'bb', 'bl', 'br'].map((k) => (c[k] === true ? 'thin' : c[k] || '')).join('|');
      const f = idx(fonts, (c.sz || 11) + '|' + (c.b ? 1 : 0)), d = idx(borders, bd);
      return idx(xfs, f + '|' + d + '|' + (c.num ? 1 : 0) + '|' + (c.h || '') + '|' + (c.va || '') + '|' + (c.wrap ? 1 : 0) + '|' + (c.ind || 0));
    };
    const xml = () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>' +
      '<fonts count="' + fonts.length + '">' + fonts.map((k) => { const q = k.split('|'); return '<font>' + (q[1] === '1' ? '<b/>' : '') + '<sz val="' + q[0] + '"/><name val="Meiryo UI"/><family val="2"/></font>'; }).join('') + '</fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="' + borders.length + '">' + borders.map((k) => { const q = k.split('|'), e = (n, v) => (v ? '<' + n + ' style="' + v + '"><color rgb="FF000000"/></' + n + '>' : '<' + n + '/>'); return '<border>' + e('left', q[2]) + e('right', q[3]) + e('top', q[0]) + e('bottom', q[1]) + '<diagonal/></border>'; }).join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + xfs.length + '">' + xfs.map((k) => { const q = k.split('|'); return '<xf numFmtId="' + (q[2] === '1' ? 164 : 0) + '" fontId="' + q[0] + '" fillId="0" borderId="' + q[1] + '" xfId="0" applyFont="1" applyBorder="1"' + (q[2] === '1' ? ' applyNumberFormat="1"' : '') + ' applyAlignment="1"><alignment' + (q[3] ? ' horizontal="' + q[3] + '"' : '') + (q[4] ? ' vertical="' + q[4] + '"' : '') + (q[5] === '1' ? ' wrapText="1"' : '') + (+q[6] ? ' indent="' + q[6] + '"' : '') + '/></xf>'; }).join('') + '</cellXfs></styleSheet>';
    return { id: id, xml: xml };
  }
  function sheetXml(sh, sb) {
    const rows = sh.rows, fit = sh.page && sh.page.fit, heights = sh.heights || {};
    const cols = sh.cols && sh.cols.length ? '<cols>' + sh.cols.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (fit ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : '') + '<sheetFormatPr defaultColWidth="16" defaultRowHeight="15"/>' + cols + '<sheetData>' +
      rows.map((r, i) => '<row r="' + (i + 1) + '"' + (heights[i + 1] ? ' ht="' + heights[i + 1] + '" customHeight="1"' : '') + '>' + r.map((c, j) => {
        const v = isCell(c) ? c.v : c, st = sb.id(c), sa = st ? ' s="' + st + '"' : '';
        if (v === null || v === undefined || v === '') return st ? '<c r="' + col(j) + (i + 1) + '"' + sa + '/>' : '';
        const ref = col(j) + (i + 1);
        return typeof v === 'number' && isFinite(v) ? '<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>' : '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      }).join('') + '</row>').join('') + '</sheetData>' +
      (sh.merges && sh.merges.length ? '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map((m) => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>' : '') +
      (sh.page ? '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="' + (sh.page.orient || 'portrait') + '"' + (fit ? ' fitToWidth="1" fitToHeight="1"' : '') + '/>' : '') + '</worksheet>';
  }
  const sname = (n, i) => esc(String(n || 'Sheet' + (i + 1)).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31));
  function build(sheets) {
    const sb = styleBook(), xmls = sheets.map((s) => sheetXml(s, sb));
    const files = [
      { name: '[Content_Types].xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>') },
      { name: '_rels/.rels', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: 'xl/workbook.xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => '<sheet name="' + sname(s.name, i) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>') },
      { name: 'xl/_rels/workbook.xml.rels', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
      { name: 'xl/styles.xml', data: enc(sb.xml()) }
    ].concat(xmls.map((x, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: enc(x) })));
    return zip(files);
  }
  function download(name, bytes) {
    const a = document.createElement('a'), url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
  }
  return { build, download };
})();
if (typeof module !== 'undefined') module.exports = Xlsx;
