# UZIP.js

Simple, tiny and fast ZIP library. It has our own DEFLATE compressor and decompressor (alternative to pako.js / ZLIB).

#### `UZIP.parse(buff)`
* `buff`: ArrayBuffer of the ZIP file
* returns an object with `key : property` pairs, where `key` is a file name (String), and `property` is a file (Uint8Array)

#### `UZIP.encode(obj)`
* `obj`: object with `key : property` pairs (see above)
* returns a ArrayBuffer of the ZIP file

Directories should be "included" inside file names.

    var obj = { "file.txt":new Uint8Array([72,69,76,76,79]),  "dir/photo.jpg":...,  "dir/pic.png":... };       
    var zip = UZIP.encode(obj);

## Deflate compression

The API is the same as the API of pako.js, just use `UZIP.xyz...` instead of `pako.xyz...`.

#### `UZIP.deflateRaw(buff)`
* `buff`: Uint8Array of the original file
* returns Uint8Array with DEFLATE stream

#### `UZIP.deflate(buff)`
* `buff`: Uint8Array of the original file
* returns Uint8Array with ZLIB stream

These two functions have an optional third parameter: Options object,
which can be `{level:L}`, where L is the level of compression (0 to 9).

#### `UZIP.inflateRaw(buff)`
* `buff`: Uint8Array containing the deflate stream
* returns Uint8Array with decompressed bytes

#### `UZIP.inflate(buff)`
* `buff`: Uint8Array containing the ZLIB stream (2 byte header + deflate stream + 4 byte checksum)
* returns Uint8Array with decompressed bytes

These two functions have an optional third parameter: Output buffer (Uint8Array). 
Practical uses of DEFLATE (like ZIP or PNG files) usually store the size of uncompressed data.
If you provide the output buffer, decompression is faster.


