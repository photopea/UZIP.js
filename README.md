# UZIP.js

Simple, tiny and fast ZIP library. It has our own DEFLATE compressor and decompressor (alternative to pako.js / ZLIB). It was made from scratch, without using existing implemetnations.

UZIP.js is faster than pako.js
- Inflate (decompression): 40% faster than Pako in Chrome, up to 50% faster in Firefox
- Deflate (compression) is almost always faster
- May produce smaller files than pako.js / ZLIB level 9 (especially for hard to compress data)

## Installation

**Web**: Add the `UZIP.js` script to your webpage:

```html
<script src="UZIP.js"></script>
```

**NodeJS**: Install the [`uzip` package](https://www.npmjs.com/package/uzip):

```
npm install uzip
```

## Interface

#### `UZIP.parse(buff)`
* `buff`: ArrayBuffer of the ZIP file
* returns an object with `key : property` pairs, where `key` is a file name (String), and `property` is a file (Uint8Array)

#### `UZIP.encode(obj)`
* `obj`: object with `key : property` pairs (see above)
* returns a ArrayBuffer of the ZIP file

Directories should be "included" inside file names.

```js
    var obj = { "file.txt":new Uint8Array([72,69,76,76,79]),  "dir/photo.jpg":...,  "dir/pic.png":... };       
    var zip = UZIP.encode(obj);
```

## Deflate compression

The API is the same as the API of pako.js, just use `UZIP.xyz...` instead of `pako.xyz...`.

#### `UZIP.deflateRaw(buff)`
* `buff`: Uint8Array of the original file
* returns Uint8Array with DEFLATE stream

#### `UZIP.deflate(buff)`
* `buff`: Uint8Array of the original file
* returns Uint8Array with ZLIB stream  (2 byte header + DEFLATE stream + 4 byte checksum)

These two functions have an optional third parameter: Options object,
which can be `{level:L}`, where L is the level of compression (0 to 9).

#### `UZIP.inflateRaw(buff)`
* `buff`: Uint8Array containing the deflate stream
* returns Uint8Array with decompressed bytes

#### `UZIP.inflate(buff)`
* `buff`: Uint8Array containing the ZLIB stream
* returns Uint8Array with decompressed bytes

These two functions have an optional third parameter: Output buffer (Uint8Array). 

DEFLATE or ZLIB stream do not directly store the size of the output uncompressed data. Decompressors usually write the result into a small array, which is enlarged (copied into a bigger array) during the process.

Practical applications of DEFLATE (like ZIP or PNG files) usually store the size of uncompressed data. If you provide the output buffer, decompression is faster (no need for gradual enlarging of the output array).


