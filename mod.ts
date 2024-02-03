import {
  readUint,
  readUshort,
  readUTF8,
  sizeUTF8,
  writeUint,
  writeUshort,
  writeUTF8,
} from "./readUshort.ts";

export const parse = async (buf: Uint8Array, onlyNames?: boolean) => {
  const data = new Uint8Array(buf);
  let eocd = data.length - 4;

  while (readUshort(data, eocd) != 0x06054b50) eocd--;

  let o = eocd;
  o += 4; // sign  = 0x06054b50
  o += 4; // disks = 0;
  const cnu = readUshort(data, o);
  o += 2;
  //   const cnt = readUshort(data, o);
  o += 2;

  //   const csize = readUint(data, o);
  o += 4;
  const coffs = readUint(data, o);
  o += 4;

  o = coffs;
  const out: Record<string, { size: number; csize: number } | Uint8Array> = {};
  for (let i = 0; i < cnu; i++) {
    // const sign = readUint(data, o);
    o += 4;
    o += 4; // versions;
    o += 4; // flag + compr
    o += 4; // time

    // const crc32 = readUint(data, o);
    o += 4;
    const csize = readUint(data, o);
    o += 4;
    const usize = readUint(data, o);
    o += 4;

    const nl = readUshort(data, o),
      el = readUshort(data, o + 2),
      cl = readUshort(data, o + 4);
    o += 6; // name, extra, comment
    o += 8; // disk, attribs

    const roff = readUint(data, o);
    o += 4;
    o += nl + el + cl;

    const { name, ...file } = await readLocal(
      data,
      roff,
      csize,
      usize,
      onlyNames ?? false,
    );
    out[name] = "file" in file ? file.file : file;
  }
  //console.log(out);
  return out;
};

const readLocal = async (
  data: Uint8Array,
  o: number,
  csize: number,
  usize: number,
  onlyNames: boolean,
): Promise<
  { name: string; size: number; csize: number } | {
    name: string;
    file: Uint8Array;
  }
> => {
  //   const sign = readUint(data, o);
  o += 4;
  //   const ver = readUshort(data, o);
  o += 2;
  //   const gpflg = readUshort(data, o);
  o += 2;
  //if((gpflg&8)!=0) throw "unknown sizes";
  const cmpr = readUshort(data, o);
  o += 2;

  //   const time = readUint(data, o);
  o += 4;

  //   const crc32 = readUint(data, o);
  o += 4;
  //var csize = readUint(data, o);  o+=4;
  //var usize = readUint(data, o);  o+=4;
  o += 8;

  const nlen = readUshort(data, o);
  o += 2;
  const elen = readUshort(data, o);
  o += 2;

  const name = readUTF8(data, o, nlen);
  o += nlen; //console.log(name);
  o += elen;

  //console.log(sign.toString(16), ver, gpflg, cmpr, crc32.toString(16), "csize, usize", csize, usize, nlen, elen, name, o);
  if (onlyNames) return { name, size: usize, csize };

  const file = new Uint8Array(data.buffer, o);
  if (cmpr == 0) {
    return { name, file: new Uint8Array(file.buffer.slice(o, o + csize)) };
  } else if (cmpr == 8) {
    const buf = new Uint8Array(
      await new Response(
        new Response(file).body?.pipeThrough(
          new CompressionStream("inflate-raw"),
        ),
      ).arrayBuffer(),
    );

    return { name, file: buf };
  } else throw "unknown compression method: " + cmpr;
};

interface File {
  cpr: boolean;
  usize: number;
  crc: number;
  file: Uint8Array;
}

export const encode = async (
  obj: Record<string, Uint8Array>,
  noCmpr?: boolean,
) => {
  if (noCmpr == null) noCmpr = false;
  let tot = 0;
  const zpd: Record<string, Promise<File>> = Object.fromEntries(
    [...Object.entries(obj)].map(
      ([key, buf]) => {
        const cpr = !noNeed(key) && !noCmpr;
        const file = (async () => ({
          cpr: cpr,
          usize: buf.length,
          crc: crc(buf, 0, buf.length),
          file: (cpr ? await deflateRaw(buf) : buf),
        }))();

        return [key, file];
      },
    ),
  );

  for (const p in zpd) {
    tot += (await zpd[p]).file.length + 30 + 46 + 2 * sizeUTF8(p);
  }
  tot += 22;

  const data = new Uint8Array(tot);
  let o = 0;
  const fof = [];

  for (const p in zpd) {
    const file = zpd[p];
    fof.push(o);
    o = writeHeader(data, o, p, await file, 0);
  }
  let i = 0;
  const ioff = o;
  for (const p in zpd) {
    const file = zpd[p];
    fof.push(o);
    o = writeHeader(data, o, p, await file, 1, fof[i++]);
  }
  const csize = o - ioff;

  writeUint(data, o, 0x06054b50);
  o += 4;
  o += 4; // disks
  writeUshort(data, o, i);
  o += 2;
  writeUshort(data, o, i);
  o += 2; // number of c d records
  writeUint(data, o, csize);
  o += 4;
  writeUint(data, o, ioff);
  o += 4;
  o += 2;
  return data.buffer;
};
// no need to compress .PNG, .ZIP, .JPEG ....
const noNeed = (fn: string) => {
  const ext = fn.split(".").pop()!.toLowerCase();
  return ["png", "jpg", "jpeg", "zip"].includes(ext);
};

const writeHeader = (
  data: Uint8Array,
  o: number,
  p: string,
  obj: File,
  t: number,
  roff?: number,
) => {
  const file = obj.file;

  writeUint(data, o, t == 0 ? 0x04034b50 : 0x02014b50);
  o += 4; // sign
  if (t == 1) o += 2; // ver made by
  writeUshort(data, o, 20);
  o += 2; // ver
  writeUshort(data, o, 0);
  o += 2; // gflip
  writeUshort(data, o, obj.cpr ? 8 : 0);
  o += 2; // cmpr

  writeUint(data, o, 0);
  o += 4; // time
  writeUint(data, o, obj.crc);
  o += 4; // crc32
  writeUint(data, o, file.length);
  o += 4; // csize
  writeUint(data, o, obj.usize);
  o += 4; // usize

  writeUshort(data, o, sizeUTF8(p));
  o += 2; // nlen
  writeUshort(data, o, 0);
  o += 2; // elen

  if (t == 1) {
    o += 2; // comment length
    o += 2; // disk number
    o += 6; // attributes
    writeUint(data, o, roff!);
    o += 4; // usize
  }
  const nlen = writeUTF8(data, o, p);
  o += nlen;
  if (t == 0) {
    data.set(file, o);
    o += file.length;
  }
  return o;
};

const crc = (b: Uint8Array, o: number, l: number) => {
  return update(0xffffffff, b, o, l) ^ 0xffffffff;
};

const table = (() => {
  const tab = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    tab[n] = c;
  }
  return tab;
})();

const update = (c: number, buf: Uint8Array, off: number, len: number) => {
  for (let i = 0; i < len; i++) {
    c = table[(c ^ buf[off + i]) & 0xff] ^ (c >>> 8);
  }
  return c;
};
const deflateRaw = async (buf: BodyInit) =>
  new Uint8Array(
    await new Response(
      new Response(buf).body!.pipeThrough(new CompressionStream("deflate-raw")),
    ).arrayBuffer(),
  );
