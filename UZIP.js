


var UZIP = {};

(function(){
	
	var B = {
		readUshort : function(buff,p)  {  return (buff[p]) | (buff[p+1]<<8);  },
		writeUshort: function(buff,p,n){  buff[p] = (n)&255;  buff[p+1] = (n>>8)&255;  },
		readUint   : function(buff,p)  {  return (buff[p+3]*(256*256*256)) + ((buff[p+2]<<16) | (buff[p+1]<< 8) | buff[p]);  },
		writeUint  : function(buff,p,n){  buff[p]=n&255;  buff[p+1]=(n>>8)&255;  buff[p+2]=(n>>16)&255;  buff[p+3]=(n>>24)&255;  },
		readASCII  : function(buff,p,l){  var s = "";  for(var i=0; i<l; i++) s += String.fromCharCode(buff[p+i]);  return s;    },
		writeASCII : function(data,p,s){  for(var i=0; i<s.length; i++) data[p+i] = s.charCodeAt(i);  },
		pad : function(n) { return n.length < 2 ? "0" + n : n; },
		readIBM  : function(buff, p, l) {
			var codes = [
				0xc7, 0xfc, 0xe9, 0xe2, 0xe4, 0xe0, 0xe5, 0xe7, 0xea,   0xeb, 0xe8, 0xef, 0xee, 0xec, 0xc4, 0xc5,
				0xc9, 0xe6, 0xc6, 0xf4, 0xf6, 0xf2, 0xfb, 0xf9, 0xff,   0xd6, 0xdc, 0xa2, 0xa3, 0xa5, 0xa7, 0x192,
				0xe1, 0xed, 0xf3, 0xfa, 0xf1, 0xd1, 0xaa, 0xba, 0xbf, 0x2310, 0xac, 0xbd, 0xbc, 0xa1, 0xab, 0xbb
			]
			var out = "";
			for(var i=0; i<l; i++) {
				var cc = buff[p+i];
				if     (cc<0x80) cc = cc;
				else if(cc<0xb0) cc = codes[cc-0x80];
				else             return null;
				out += String.fromCharCode(cc);
			}
			return out;
		},
		readUTF8 : function(buff, p, l) {
			var s = "", ns;
			for(var i=0; i<l; i++) s += "%" + B.pad(buff[p+i].toString(16));
			try {  ns = decodeURIComponent(s); }
			catch(e) {  return B.readASCII(buff, p, l);  }
			return  ns;
		},
		writeUTF8 : function(buff, p, str) {
			var strl = str.length, i=0;
			for(var ci=0; ci<strl; ci++)
			{
				var code = str.charCodeAt(ci);
				if     ((code&(0xffffffff-(1<< 7)+1))==0) {  buff[p+i] = (     code     );  i++;  }
				else if((code&(0xffffffff-(1<<11)+1))==0) {  buff[p+i] = (192|(code>> 6));  buff[p+i+1] = (128|((code>> 0)&63));  i+=2;  }
				else if((code&(0xffffffff-(1<<16)+1))==0) {  buff[p+i] = (224|(code>>12));  buff[p+i+1] = (128|((code>> 6)&63));  buff[p+i+2] = (128|((code>>0)&63));  i+=3;  }
				else if((code&(0xffffffff-(1<<21)+1))==0) {  buff[p+i] = (240|(code>>18));  buff[p+i+1] = (128|((code>>12)&63));  buff[p+i+2] = (128|((code>>6)&63));  buff[p+i+3] = (128|((code>>0)&63)); i+=4;  }
				else throw "e";
			}
			return i;
		},
		sizeUTF8 : function(str) {
			var strl = str.length, i=0;
			for(var ci=0; ci<strl; ci++)
			{
				var code = str.charCodeAt(ci);
				if     ((code&(0xffffffff-(1<< 7)+1))==0) {  i++ ;  }
				else if((code&(0xffffffff-(1<<11)+1))==0) {  i+=2;  }
				else if((code&(0xffffffff-(1<<16)+1))==0) {  i+=3;  }
				else if((code&(0xffffffff-(1<<21)+1))==0) {  i+=4;  }
				else throw "e";
			}
			return i;
		}
	}
	
	var crc = {
		table : ( function() {
		   var tab = new Uint32Array(256);
		   for (var n=0; n<256; n++) {
				var c = n;
				for (var k=0; k<8; k++) {
					if (c & 1)  c = 0xedb88320 ^ (c >>> 1);
					else        c = c >>> 1;
				}
				tab[n] = c;  }    
			return tab;  })(),
		update : function(c, buf, off, len) {
			for (var i=0; i<len; i++)  c = crc.table[(c ^ buf[off+i]) & 0xff] ^ (c >>> 8);
			return c;
		},
		crc : function(b,o,l)  {  return crc.update(0xffffffff,b,o,l) ^ 0xffffffff;  }
	}
	
	function adler(data,o,len) {
		var a = 1, b = 0;
		var off = o, end=o+len;
		while(off<end) {
			var eend = Math.min(off+5552, end);
			while(off<eend) {
				a += data[off++];
				b += a;
			}
			a=a%65521;
			b=b%65521;
		}
		return (b << 16) | a;
	}
	
	function parseTar(data) {
		var off = 0, out={};
		while(off+1024<data.length) {
			var no=off;  while(data[no]!=0) no++;
			var nam = B.readASCII(data,off,no-off);  off+=100;
			off+=24;
			var sz = parseInt(B.readASCII(data,off,12),8);  off+=12;
			var tm = parseInt(B.readASCII(data,off,12),8);  off+=12;
			// console.log(nam, sz, tm);  
			off+=8+1+100;
			off+=6+2+32+32+8+8+155+12;
		
			out[nam] = data.slice(off,off+sz);
			off+=sz;
			
			var ex = off&0x1ff;  if(ex!=0) off+=512-ex;
		}
		return out;
	}
	/*
	var parse7z = function() {
		var rUs = B.readUshort, rUi = B.readUint;
		var data, off;
		
		function NUMBER() {
			var v = data[off++];
			if     ((v&128)==0) return v;
			else if((v& 64)==0) return ((((((v&63)<<8)+data[off++])    )           )   );
			else if((v& 32)==0) return ((((((v&31)<<8)+data[off++])<<8)+data[off++])   );
			else if((v& 16)==0) return ((((((v&31)<<8)+data[off++])<<8)+data[off++])<<8)+data[off++];
			else throw v.toString(2);
		}
		
		function readProp() {
			var ID = data[off++];  console.log(ID.toString(16));
			
			if     (ID==0x17) readProp(off);  // EncodedHeader
			else if(ID==0x06) { 			  // PackInfo
				var pos = NUMBER();  
				var cnt = NUMBER();  if(cnt!=1) throw "e";
				
				console.log(pos, cnt);
				
				console.log(data.slice(off));
				
				var siz = readProp();  console.log(siz);
				
				console.log(data.slice(off));
				
				var crc = readProp();  console.log(crc);
				
				
				console.log(data.slice(off));
			}
			else if(ID==0x09) { 			 // Size
				return NUMBER();
			}
			else throw ID;
			
		}
		
		function pars(_d) {
			data = _d;  off=8;
			
			var sign = [55, 122, 188, 175, 39, 28, 0, 4];
			for(var i=0; i<8; i++) if(data[i]!=sign[i]) throw "e";
			
			var crc = rUi(data,off);  off+=4;
			
			var nho = rUi(data,off);  off+=8;
			var nhs = rUi(data,off);  off+=8;
			var nhc = rUi(data,off);  off+=4;
			console.log(nho,nhs,nhc);
			
			//var hdr=data[off++];
			
			//console.log(hdr);
			
			off = 32+nho;
			readProp();
			
			
			
			
			
			console.log(data.slice(off));  throw "e";
		}
	
		return pars;
	}();
	*/

	function parse(buf, onlyNames)	// ArrayBuffer
	{
		var rUs = B.readUshort, rUi = B.readUint, o = 0, out = {};
		var data = new Uint8Array(buf);
		if(data.length>257+6 && B.readASCII(data,257,6)=="ustar ") return parseTar(data);
		//if(B.readASCII(data,0,2)=="7z") return parse7z(data);
		
		var eocd = data.length-4;
		
		while(rUi(data, eocd)!=0x06054b50) eocd--;
		
		var o = eocd;
		o+=4;	// sign  = 0x06054b50
		o+=4;  // disks = 0;
		var cnu = rUs(data, o);  o+=2;
		var cnt = rUs(data, o);  o+=2;
				
		var csize = rUi(data, o);  o+=4;
		var coffs = rUi(data, o);  o+=4;
		
		o = coffs;
		for(var i=0; i<cnu; i++)
		{
			var sign = rUi(data, o);  o+=4;
			o += 4;  // versions;
			o += 4;  // flag + compr
			var time = _readTime(data,o);  o += 4;  // time
			
			var crc32 = rUi(data, o);  o+=4;
			var csize = rUi(data, o);  o+=4;
			var usize = rUi(data, o);  o+=4;
			
			var nl = rUs(data, o), el = rUs(data, o+2), cl = rUs(data, o+4);  o += 6;  // name, extra, comment
			o += 8;  // disk, attribs
			var roff = rUi(data, o);  o+=4;
			
			o += nl;
			
			var lo=0;
			while(lo<el) {
				var id=rUs(data,o+lo);  lo+=2;
				var sz=rUs(data,o+lo);  lo+=2;
				if(id==1) {  // Zip64
					if(usize==0xffffffff) {  usize=rUi(data,o+lo);  lo+=8;  }
					if(csize==0xffffffff) {  csize=rUi(data,o+lo);  lo+=8;  }
					if(roff ==0xffffffff) {  roff =rUi(data,o+lo);  lo+=8;  }
				}
				else lo+=sz;
			}
			
			o += el + cl;
			
			_readLocal(data, roff, out, csize, usize, onlyNames);
		}
		//console.log(out);
		return out;
	}

	function _readTime(data,o) {
		var time = B.readUshort(data,o), date = B.readUshort(data,o+2);
		var year = 1980+(date>>>9);
		var mont = (date>>>5)&15;
		var day  = (date)&31;
		//console.log(year,mont,day);
		
		var hour = (time>>>11);
		var minu = (time>>> 5)&63;
		var seco = 2*(time&31);
		
		var stamp = new Date(year,mont,day,hour,minu,seco).getTime();
		
		//console.log(date,time);
		return stamp;
	}
	function _writeTime(data,o,stamp) {
		var dt = new Date(stamp);
		var date = ((dt.getFullYear()-1980)<<9) | ((dt.getMonth()+1)<<5) | dt.getDate();
		var time = (dt.getHours()<<11) | (dt.getMinutes()<<5) | (dt.getSeconds()>>>1);
		B.writeUshort(data,o,time);
		B.writeUshort(data,o+2,date);
	}


	function _readLocal(data, o, out, csize, usize, onlyNames)
	{
		var rUs = B.readUshort, rUi = B.readUint;
		var sign  = rUi(data, o);  o+=4;
		var ver   = rUs(data, o);  o+=2;
		var gpflg = rUs(data, o);  o+=2;
		//if((gpflg&8)!=0) throw "unknown sizes";
		var cmpr  = rUs(data, o);  o+=2;
		
		var time  = _readTime(data,o);  o+=4;
		
		var crc32 = rUi(data, o);  o+=4;
		//var csize = rUi(data, o);  o+=4;
		//var usize = rUi(data, o);  o+=4;
		o+=8;
			
		var nlen  = rUs(data, o);  o+=2;
		var elen  = rUs(data, o);  o+=2;
			
		var name =  (gpflg&2048)==0 ? B.readIBM(data,o,nlen) : B.readUTF8(data, o, nlen);  
		if(name==null) name=B.readUTF8(data, o, nlen);
		o += nlen;  //console.log(name);
		o += elen;
				
		//console.log(sign.toString(16), ver, gpflg, cmpr, crc32.toString(16), "csize, usize", csize, usize, nlen, elen, name, o);
		if(onlyNames) {  out[name]={size:usize, csize:csize};  return;  }   
		var file = new Uint8Array(data.buffer, o);
		if(gpflg&1) {  out[name] = new Uint8Array(0);  alert("ZIPs with a password are not supported.",3000);  }
		else if(cmpr==0) out[name] = new Uint8Array(file.buffer.slice(o, o+csize));
		else if(cmpr==8) {
			var buf = new Uint8Array(usize);  inflateRaw(file, buf);
			/*var nbuf = pako["inflateRaw"](file);
			if(usize>8514000) {
				//console.log(PUtils.readASCII(buf , 8514500, 500));
				//console.log(PUtils.readASCII(nbuf, 8514500, 500));
			}
			for(var i=0; i<buf.length; i++) if(buf[i]!=nbuf[i]) {  console.log(buf.length, nbuf.length, usize, i);  throw "e";  }
			*/
			out[name] = buf;
		}
		else if(cmpr==14 && window["LZMA"]) {
			var vsn = rUs(file,0);
			var siz = rUs(file,2);  if(siz!=5) throw "unknown LZMA header";
			
			var prp = file[4];
			var dictSize = rUi(file,5);
			var lc = prp % 9;
			prp = ~~(prp / 9);
			var lp = prp % 5;
			var pb = ~~(prp / 5);
			//console.log(vsn,siz,dictSize,lc,lp,pb);
			
			//console.log(file);
			var time = Date.now();
			var buf = out[name] = new Uint8Array(usize);
						
			var dec = new window["LZMA"]["Decoder"]();
			dec["setProperties"]({ "dsz":dictSize, "lc":lc, "lp":lp, "pb":pb });
			dec["decodeBody"](new Uint8Array(data.buffer,o+9),buf, usize);
			
			//console.log(Date.now()-time);
		}
		else throw "unknown compression method: "+cmpr;
	}
	
	function UStream(buf) {  this.buf = buf;  this.off = 0;  }
	UStream.prototype["readByte"]  = function(   ) {  return this.buf[this.off++];  }
	UStream.prototype["writeByte"] = function(b  ) {  this.buf[this.off++] = b;     }
	UStream.prototype["writeBytes"]= function(a,s) {  a = new Uint8Array(a.buffer,a.byteOffset,Math.min(a.length,this.buf.length-this.off));  this.buf.set(a,this.off);  this.off+=a.length;  }

	function inflateRaw(file, buf) {  return UZIP["F"]["inflate"](file, buf);  }
	function inflate(file, buf) { 
		var CMF = file[0], FLG = file[1];
		if(CMF==31 && FLG==139) {  // GZIP
			var CM = file[2], FLG = file[3];  if(CM!=8) throw CM;  /* 8 is DEFLATE */
			var off = 4;  off+=4;  // MTIME
			off+=2;  // XFL, OS
			if((FLG& 4)!=0) throw "e";  // FEXTRA
			if((FLG& 8)!=0) {           // FNAME
				while(file[off]!=0) off++;  off++;
			}
			if((FLG&16)!=0) throw "e";  // FCOMMENT
			if((FLG& 2)!=0) throw "e";  // FHCR
			return inflateRaw(new Uint8Array(file.buffer, file.byteOffset+off, file.length-off-8), buf);  
		}
		var CM = (CMF&15), CINFO = (CMF>>>4);
		//console.log(CM, CINFO,CMF,FLG);
		return inflateRaw(new Uint8Array(file.buffer, file.byteOffset+2, file.length-6), buf);  
	}
	function deflate(data, opts/*, buf, off*/) {
		if(opts==null) opts={"level":6};
		var off=0, buf=new Uint8Array(50+Math.floor(data.length*1.1));
		buf[off]=120;  buf[off+1]=156;  off+=2;
		off = UZIP["F"]["deflateRaw"](data, buf, off, opts["level"]);
		var crc = adler(data, 0, data.length);
		buf[off+0]=((crc>>>24)&255); 
		buf[off+1]=((crc>>>16)&255); 
		buf[off+2]=((crc>>> 8)&255); 
		buf[off+3]=((crc>>> 0)&255); 	
		return new Uint8Array(buf.buffer, 0, off+4);
	}
	function deflateRaw(data, opts) {
		if(opts==null) opts={"level":6};
		var buf=new Uint8Array(50+Math.floor(data.length*1.1));
		var off = UZIP["F"]["deflateRaw"](data, buf, off, opts["level"]);
		return new Uint8Array(buf.buffer, 0, off);
	}


	function encode(obj, noCmpr) {
		if(noCmpr==null) noCmpr=false;
		var tot = 0, wUi = B.writeUint, wUs = B.writeUshort;
		var zpd = {};
		for(var p in obj) {  var cpr = !_noNeed(p) && !noCmpr, buf = obj[p], cr = crc.crc(buf,0,buf.length); 
			zpd[p] = {  cpr:cpr, usize:buf.length, crc:cr, file: (cpr ? deflateRaw(buf) : buf)  };  }
		
		for(var p in zpd) tot += zpd[p].file.length + 30 + 46 + 2*B.sizeUTF8(p);
		tot +=  22;
		
		var data = new Uint8Array(tot), o = 0;
		var fof = []
		
		for(var p in zpd) {
			var file = zpd[p];  fof.push(o);
			o = _writeHeader(data, o, p, file, 0);
		}
		var i=0, ioff = o;
		for(var p in zpd) {
			var file = zpd[p];  fof.push(o);
			o = _writeHeader(data, o, p, file, 1, fof[i++]);		
		}
		var csize = o-ioff;
		
		wUi(data, o, 0x06054b50);  o+=4;
		o += 4;  // disks
		wUs(data, o, i);  o += 2;
		wUs(data, o, i);  o += 2;	// number of c d records
		wUi(data, o, csize);  o += 4;
		wUi(data, o, ioff );  o += 4;
		o += 2;
		return data.buffer;
	}
	// no need to compress .PNG, .ZIP, .JPEG ....
	function _noNeed(fn) {  var ext = fn.split(".").pop().toLowerCase();  return "png,jpg,jpeg,zip".indexOf(ext)!=-1;  }

	function _writeHeader(data, o, p, obj, t, roff)
	{
		// it is a task of a user to provide valid file names
		//var bad = "#%&{}\<>*?$'\":@+`|=";
		//for(var i=0; i<p.length; i++) if(bad.indexOf(p[i])!=-1) p = p.slice(0,i)+"_"+p.slice(i+1);
		
		var wUi = B.writeUint, wUs = B.writeUshort;
		var file = obj.file;
		
		wUi(data, o, t==0 ? 0x04034b50 : 0x02014b50);  o+=4; // sign
		if(t==1) o+=2;  // ver made by
		wUs(data, o, 20);  o+=2;	// ver
		wUs(data, o,  2048);  o+=2;    // gflip
		wUs(data, o,  obj.cpr?8:0);  o+=2;	// cmpr
			
		_writeTime(data,o,Date.now());  o+=4;//wUi(data, o,  0);  o+=4;	// time		
		wUi(data, o, obj.crc);  o+=4;	// crc32
		wUi(data, o, file.length);  o+=4;	// csize
		wUi(data, o, obj.usize);  o+=4;	// usize
			
		wUs(data, o, B.sizeUTF8(p));  o+=2;	// nlen
		wUs(data, o, 0);  o+=2;	// elen
		
		if(t==1) {
			o += 2;  // comment length
			o += 2;  // disk number
			o += 6;  // attributes
			wUi(data, o, roff);  o+=4;	// usize
		}
		var nlen = B.writeUTF8(data, o, p);  o+= nlen;	
		if(t==0) {  data.set(file, o);  o += file.length;  }
		return o;
	}

	
	UZIP["crc"  ] = crc;
	UZIP["adler"  ] = adler;
	
	UZIP["inflate"   ] = inflate;
	UZIP["inflateRaw"] = inflateRaw;
	UZIP["deflate"   ] = deflate;
	UZIP["deflateRaw"] = deflateRaw;
	UZIP["parse"     ] = parse;
	UZIP["encode"    ] = encode;
})();







(function() {
	
	var U = (function(){
		var u16=Uint16Array, u32=Uint32Array;
		return {
			next_code : new u16(16),
			bl_count  : new u16(16),
			ordr : [ 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 ],
			of0  : [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,999,999,999],
			exb  : [0,0,0,0,0,0,0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4,  4,  5,  5,  5,  5,  0,  0,  0,  0],
			ldef : new u16(32),
			df0  : [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577, 65535, 65535],
			dxb  : [0,0,0,0,1,1,2, 2, 3, 3, 4, 4, 5, 5,  6,  6,  7,  7,  8,  8,   9,   9,  10,  10,  11,  11,  12,   12,   13,   13,     0,     0],
			ddef : new u32(32),
			flmap: new u16(  512),  fltree: [],
			fdmap: new u16(   32),  fdtree: [],
			lmap : new u16(32768),  ltree : [],  ttree:[],
			dmap : new u16(32768),  dtree : [],
			imap : new u16(  512),  itree : [],
			//rev9 : new u16(  512)
			rev15: new u16(1<<15),
			lhst : new u32(286), dhst : new u32( 30), ihst : new u32(19),
			lits : new u32(15000),
			strt : new u16(1<<16),
			prev : new u16(1<<15)
		};  
	})();
	
	function makeCodes(tree, MAX_BITS) {  // code, length
		var max_code = tree.length;
		var code, bits, n, i, len;
		
		var bl_count = U.bl_count;  for(var i=0; i<=MAX_BITS; i++) bl_count[i]=0;
		for(i=1; i<max_code; i+=2) bl_count[tree[i]]++;
		
		var next_code = U.next_code;	// smallest code for each length
		
		code = 0;
		bl_count[0] = 0;
		for (bits = 1; bits <= MAX_BITS; bits++) {
			code = (code + bl_count[bits-1]) << 1;
			next_code[bits] = code;
		}
		
		for (n = 0; n < max_code; n+=2) {
			len = tree[n+1];
			if (len != 0) {
				tree[n] = next_code[len];
				next_code[len]++;
			}
		}
	}
	function codes2map(tree, MAX_BITS, map) {
		var max_code = tree.length;
		var r15 = U.rev15;
		for(var i=0; i<max_code; i+=2) if(tree[i+1]!=0)  {
			var lit = i>>1;
			var cl = tree[i+1], val = (lit<<4)|cl; // :  (0x8000 | (U.of0[lit-257]<<7) | (U.exb[lit-257]<<4) | cl);
			var rest = (MAX_BITS-cl), i0 = tree[i]<<rest, i1 = i0 + (1<<rest);
			//tree[i]=r15[i0]>>>(15-MAX_BITS);
			while(i0!=i1) {
				var p0 = r15[i0]>>>(15-MAX_BITS);
				map[p0]=val;  i0++;
			}
		}
	}
	function revCodes(tree, MAX_BITS) {
		var r15 = U.rev15, imb = 15-MAX_BITS;
		for(var i=0; i<tree.length; i+=2) {  var i0 = (tree[i]<<(MAX_BITS-tree[i+1]));  tree[i] = r15[i0]>>>imb;  }
	}

	// used only in deflate
	function _putsE(dt, pos, val   ) {  val = val<<(pos&7);  var o=(pos>>>3);  dt[o]|=val;  dt[o+1]|=(val>>>8);                        }
	function _putsF(dt, pos, val   ) {  val = val<<(pos&7);  var o=(pos>>>3);  dt[o]|=val;  dt[o+1]|=(val>>>8);  dt[o+2]|=(val>>>16);  }

	function _bitsE(dt, pos, length) {  return ((dt[pos>>>3] | (dt[(pos>>>3)+1]<<8)                        )>>>(pos&7))&((1<<length)-1);  }
	function _bitsF(dt, pos, length) {  return ((dt[pos>>>3] | (dt[(pos>>>3)+1]<<8) | (dt[(pos>>>3)+2]<<16))>>>(pos&7))&((1<<length)-1);  }
	
	function _get17(dt, pos) {	// return at least 17 meaningful bytes
		return (dt[pos>>>3] | (dt[(pos>>>3)+1]<<8) | (dt[(pos>>>3)+2]<<16) )>>>(pos&7);
	}
	function _get25(dt, pos) {	// return at least 17 meaningful bytes
		return (dt[pos>>>3] | (dt[(pos>>>3)+1]<<8) | (dt[(pos>>>3)+2]<<16) | (dt[(pos>>>3)+3]<<24) )>>>(pos&7);
	}
	

	(function(){	
		var len = 1<<15;
		for(var i=0; i<len; i++) {
			var x = i;
			x = (((x & 0xaaaaaaaa) >>> 1) | ((x & 0x55555555) << 1));
			x = (((x & 0xcccccccc) >>> 2) | ((x & 0x33333333) << 2));
			x = (((x & 0xf0f0f0f0) >>> 4) | ((x & 0x0f0f0f0f) << 4));
			x = (((x & 0xff00ff00) >>> 8) | ((x & 0x00ff00ff) << 8));
			U.rev15[i] = (((x >>> 16) | (x << 16)))>>>17;
		}
		
		function pushV(tgt, n, sv) {  while(n--!=0) tgt.push(0,sv);  }
		
		for(var i=0; i<32; i++) {  U.ldef[i]=(U.of0[i]<<3)|U.exb[i];  U.ddef[i]=(U.df0[i]<<4)|U.dxb[i];  }
		
		pushV(U.fltree, 144, 8);  pushV(U.fltree, 255-143, 9);  pushV(U.fltree, 279-255, 7);  pushV(U.fltree,287-279,8);
		/*
		var i = 0;
		for(; i<=143; i++) U.fltree.push(0,8);
		for(; i<=255; i++) U.fltree.push(0,9);
		for(; i<=279; i++) U.fltree.push(0,7);
		for(; i<=287; i++) U.fltree.push(0,8);
		*/
		makeCodes(U.fltree, 9);
		codes2map(U.fltree, 9, U.flmap);
		revCodes (U.fltree, 9)
		
		pushV(U.fdtree,32,5);
		//for(i=0;i<32; i++) U.fdtree.push(0,5);
		makeCodes(U.fdtree, 5);
		codes2map(U.fdtree, 5, U.fdmap);
		revCodes (U.fdtree, 5)
		
		pushV(U.itree,19,0);  pushV(U.ltree,286,0);  pushV(U.dtree,30,0);  pushV(U.ttree,320,0);
		/*
		for(var i=0; i< 19; i++) U.itree.push(0,0);
		for(var i=0; i<286; i++) U.ltree.push(0,0);
		for(var i=0; i< 30; i++) U.dtree.push(0,0);
		for(var i=0; i<320; i++) U.ttree.push(0,0);
		*/
	})();

	function deflateRaw(data, out, opos, lvl) {	
		var opts = [
		/*
			 ush good_length; /* reduce lazy search above this match length 
			 ush max_lazy;    /* do not perform lazy search above this match length 
			 ush nice_length; /* quit search above this match length 
		*/
		/*      good lazy nice chain */
		/* 0 */ [ 0,   0,   0,    0,0],  /* store only */
		/* 1 */ [ 4,   4,   8,    4,0], /* max speed, no lazy matches */
		/* 2 */ [ 4,   5,  16,    8,0],
		/* 3 */ [ 4,   6,  16,   16,0],

		/* 4 */ [ 4,  10,  16,   32,0],  /* lazy matches */
		/* 5 */ [ 8,  16,  32,   32,0],
		/* 6 */ [ 8,  16, 128,  128,0],
		/* 7 */ [ 8,  32, 128,  256,0],
		/* 8 */ [32, 128, 258, 1024,1],
		/* 9 */ [32, 258, 258, 4096,1]]; /* max compression */
		
		var opt = opts[lvl];
		
		
		//var U = UZIP.F.U, goodIndex = UZIP.F._goodIndex, hash = UZIP.F._hash, putsE = UZIP.F._putsE;
		var i = 0, pos = opos<<3, cvrd = 0, dlen = data.length;
		
		if(lvl==0) {
			while(i<dlen) {   var len = Math.min(0xffff, dlen-i);
				_putsE(out, pos, (i+len==dlen ? 1 : 0));  pos = _copyExact(data, i, len, out, pos+8);  i += len;  }
			return pos>>>3;
		}

		var lits = U.lits, strt=U.strt, prev=U.prev, li=0, lc=0, bs=0, ebits=0, c=0, nc=0;  // last_item, literal_count, block_start
		if(dlen>2) {  nc=_hash(data,0);  strt[nc]=0;  }
		var nmch=0,nmci=0;
		
		for(i=0; i<dlen; i++)  {
			c = nc;
			//*
			if(i+1<dlen-2) {
				nc = _hash(data, i+1);
				var ii = ((i+1)&0x7fff);
				prev[ii]=strt[nc];
				strt[nc]=ii;
			} //*/
			if(cvrd<=i) {
				if((li>14000 || lc>26697) && (dlen-i)>100) {
					if(cvrd<i) {  lits[li]=i-cvrd;  li+=2;  cvrd=i;  }
					pos = _writeBlock(((i==dlen-1) || (cvrd==dlen))?1:0, lits, li, ebits, data,bs,i-bs, out, pos);  li=lc=ebits=0;  bs=i;
				}
				
				var mch = 0;
				//if(nmci==i) mch= nmch;  else 
				if(i<dlen-2) mch = _bestMatch(data, i, prev, c, Math.min(opt[2],dlen-i), opt[3]);
				/*
				if(mch!=0 && opt[4]==1 && (mch>>>16)<opt[1] && i+1<dlen-2) {
					nmch = UZIP.F._bestMatch(data, i+1, prev, nc, opt[2], opt[3]);  nmci=i+1;
					//var mch2 = UZIP.F._bestMatch(data, i+2, prev, nnc);  //nmci=i+1;
					if((nmch>>>16)>(mch>>>16)) mch=0;
				}//*/
				var len = mch>>>16, dst = mch&0xffff;  //if(i-dst<0) throw "e";
				if(mch!=0) { 
					var len = mch>>>16, dst = mch&0xffff;  //if(i-dst<0) throw "e";
					var lgi = _goodIndex(len, U.of0);  U.lhst[257+lgi]++; 
					var dgi = _goodIndex(dst, U.df0);  U.dhst[    dgi]++;  ebits += U.exb[lgi] + U.dxb[dgi]; 
					lits[li] = (len<<23)|(i-cvrd);  lits[li+1] = (dst<<16)|(lgi<<8)|dgi;  li+=2;
					cvrd = i + len;  
				}
				else {	U.lhst[data[i]]++;  }
				lc++;
			}
		}
		if(bs!=i || data.length==0) {
			if(cvrd<i) {  lits[li]=i-cvrd;  li+=2;  cvrd=i;  }
			pos = _writeBlock(1, lits, li, ebits, data,bs,i-bs, out, pos);  li=0;  lc=0;  li=lc=ebits=0;  bs=i;
		}
		while((pos&7)!=0) pos++;
		return pos>>>3;
	}
	function _bestMatch(data, i, prev, c, nice, chain) {
		var ci = (i&0x7fff), pi=prev[ci];  
		//console.log("----", i);
		var dif = ((ci-pi + (1<<15)) & 0x7fff);  if(pi==ci || c!=_hash(data,i-dif)) return 0;
		var tl=0, td=0;  // top length, top distance
		var dlim = Math.min(0x7fff, i);
		while(dif<=dlim && --chain!=0 && pi!=ci /*&& c==UZIP.F._hash(data,i-dif)*/) {
			if(tl==0 || (data[i+tl]==data[i+tl-dif])) {
				var cl = _howLong(data, i, dif);
				if(cl>tl) {  
					tl=cl;  td=dif;  if(tl>=nice) break;    //* 
					if(dif+2<cl) cl = dif+2;
					var maxd = 0; // pi does not point to the start of the word
					for(var j=0; j<cl-2; j++) {
						var ei =  (i-dif+j+ (1<<15)) & 0x7fff;
						var li = prev[ei];
						var curd = (ei-li + (1<<15)) & 0x7fff;
						if(curd>maxd) {  maxd=curd;  pi = ei; }
					}  //*/
				}
			}
			
			ci=pi;  pi = prev[ci];
			dif += ((ci-pi + (1<<15)) & 0x7fff);
		}
		return (tl<<16)|td;
	}
	function _howLong(data, i, dif) {
		if(data[i]!=data[i-dif] || data[i+1]!=data[i+1-dif] || data[i+2]!=data[i+2-dif]) return 0;
		var oi=i, l = Math.min(data.length, i+258);  i+=3;
		//while(i+4<l && data[i]==data[i-dif] && data[i+1]==data[i+1-dif] && data[i+2]==data[i+2-dif] && data[i+3]==data[i+3-dif]) i+=4;
		while(i<l && data[i]==data[i-dif]) i++;
		return i-oi;
	}
	function _hash(data, i) {
		return (((data[i]<<8) | data[i+1])+(data[i+2]<<4))&0xffff;
		//var hash_shift = 0, hash_mask = 255;
		//var h = data[i+1] % 251;
		//h = (((h << 8) + data[i+2]) % 251);
		//h = (((h << 8) + data[i+2]) % 251);
		//h = ((h<<hash_shift) ^ (c) ) & hash_mask;
		//return h | (data[i]<<8);
		//return (data[i] | (data[i+1]<<8));
	}
	//UZIP.___toth = 0;
	//UZIP.saved = 0;
	function _writeBlock(BFINAL, lits, li, ebits, data,o0,l0, out, pos) {
		//var U = UZIP.F.U, putsF = UZIP.F._putsF, putsE = UZIP.F._putsE;
		
		//*
		var T, ML, MD, MH, numl, numd, numh, lset, dset;  U.lhst[256]++;
		T = getTrees(); ML=T[0]; MD=T[1]; MH=T[2]; numl=T[3]; numd=T[4]; numh=T[5]; lset=T[6]; dset=T[7];
		
		var cstSize = (((pos+3)&7)==0 ? 0 : 8-((pos+3)&7)) + 32 + (l0<<3);
		var fxdSize = ebits + contSize(U.fltree, U.lhst) + contSize(U.fdtree, U.dhst);
		var dynSize = ebits + contSize(U.ltree , U.lhst) + contSize(U.dtree , U.dhst);
		dynSize    += 14 + 3*numh + contSize(U.itree, U.ihst) + (U.ihst[16]*2 + U.ihst[17]*3 + U.ihst[18]*7);
		
		for(var j=0; j<286; j++) U.lhst[j]=0;   for(var j=0; j<30; j++) U.dhst[j]=0;   for(var j=0; j<19; j++) U.ihst[j]=0;
		//*/
		var BTYPE = (cstSize<fxdSize && cstSize<dynSize) ? 0 : ( fxdSize<dynSize ? 1 : 2 );
		_putsF(out, pos, BFINAL);  _putsF(out, pos+1, BTYPE);  pos+=3;
		
		var opos = pos;
		if(BTYPE==0) {
			while((pos&7)!=0) pos++;
			pos = _copyExact(data, o0, l0, out, pos);
		}
		else {
			var ltree, dtree;
			if(BTYPE==1) {  ltree=U.fltree;  dtree=U.fdtree;  }
			if(BTYPE==2) {	
				makeCodes(U.ltree, ML);  revCodes(U.ltree, ML);
				makeCodes(U.dtree, MD);  revCodes(U.dtree, MD);
				makeCodes(U.itree, MH);  revCodes(U.itree, MH);
				
				ltree = U.ltree;  dtree = U.dtree;
				
				_putsE(out, pos,numl-257);  pos+=5;  // 286
				_putsE(out, pos,numd-  1);  pos+=5;  // 30
				_putsE(out, pos,numh-  4);  pos+=4;  // 19
				
				for(var i=0; i<numh; i++) _putsE(out, pos+i*3, U.itree[(U.ordr[i]<<1)+1]);   pos+=3* numh;
				pos = _codeTiny(lset, U.itree, out, pos);
				pos = _codeTiny(dset, U.itree, out, pos);
			}
			
			var off=o0;
			for(var si=0; si<li; si+=2) {
				var qb=lits[si], len=(qb>>>23), end = off+(qb&((1<<23)-1));
				while(off<end) pos = _writeLit(data[off++], ltree, out, pos);
				
				if(len!=0) {
					var qc = lits[si+1], dst=(qc>>16), lgi=(qc>>8)&255, dgi=(qc&255);
					pos = _writeLit(257+lgi, ltree, out, pos);
					_putsE(out, pos, len-U.of0[lgi]);  pos+=U.exb[lgi];
					
					pos = _writeLit(dgi, dtree, out, pos);
					_putsF(out, pos, dst-U.df0[dgi]);  pos+=U.dxb[dgi];  off+=len;
				}
			}
			pos = _writeLit(256, ltree, out, pos);
		}
		//console.log(pos-opos, fxdSize, dynSize, cstSize);
		return pos;
	}
	function _copyExact(data,off,len,out,pos) {
		var p8 = (pos>>>3);
		out[p8]=(len);  out[p8+1]=(len>>>8);  out[p8+2]=255-out[p8];  out[p8+3]=255-out[p8+1];  p8+=4;
		out.set(new Uint8Array(data.buffer, off, len), p8);
		//for(var i=0; i<len; i++) out[p8+i]=data[off+i];
		return pos + ((len+4)<<3);
	}
	/*
		Interesting facts:
		- decompressed block can have bytes, which do not occur in a Huffman tree (copied from the previous block by reference)
	*/

	function getTrees() {
		var ML = _hufTree(U.lhst, U.ltree, 15);
		var MD = _hufTree(U.dhst, U.dtree, 15);
		var lset = [], numl = _lenCodes(U.ltree, lset);
		var dset = [], numd = _lenCodes(U.dtree, dset);
		for(var i=0; i<lset.length; i+=2) U.ihst[lset[i]]++;
		for(var i=0; i<dset.length; i+=2) U.ihst[dset[i]]++;
		var MH = _hufTree(U.ihst, U.itree,  7);
		var numh = 19;  while(numh>4 && U.itree[(U.ordr[numh-1]<<1)+1]==0) numh--;
		return [ML, MD, MH, numl, numd, numh, lset, dset];
	}
	function getSecond(a) {  var b=[];  for(var i=0; i<a.length; i+=2) b.push  (a[i+1]);  return b;  }
	function nonZero(a) {  var b= "";  for(var i=0; i<a.length; i+=2) if(a[i+1]!=0)b+=(i>>1)+",";  return b;  }
	function contSize(tree, hst) {  var s=0;  for(var i=0; i<hst.length; i++) s+= hst[i]*tree[(i<<1)+1];  return s;  }
	function _codeTiny(set, tree, out, pos) {
		for(var i=0; i<set.length; i+=2) {
			var l = set[i], rst = set[i+1];  //console.log(l, pos, tree[(l<<1)+1]);
			pos = _writeLit(l, tree, out, pos);
			var rsl = l==16 ? 2 : (l==17 ? 3 : 7);
			if(l>15) {  _putsE(out, pos, rst, rsl);  pos+=rsl;  }
		}
		return pos;
	}
	function _lenCodes(tree, set) {
		var len=tree.length;  while(len!=2 && tree[len-1]==0) len-=2;  // when no distances, keep one code with length 0
		for(var i=0; i<len; i+=2) {
			var l = tree[i+1], nxt = (i+3<len ? tree[i+3]:-1),  nnxt = (i+5<len ? tree[i+5]:-1),  prv = (i==0 ? -1 : tree[i-1]);
			if(l==0 && nxt==l && nnxt==l) {
				var lz = i+5;
				while(lz+2<len && tree[lz+2]==l) lz+=2;
				var zc = Math.min((lz+1-i)>>>1, 138);
				if(zc<11) set.push(17, zc-3);
				else set.push(18, zc-11);
				i += zc*2-2;
			}
			else if(l==prv && nxt==l && nnxt==l) {
				var lz = i+5;
				while(lz+2<len && tree[lz+2]==l) lz+=2;
				var zc = Math.min((lz+1-i)>>>1, 6);
				set.push(16, zc-3);
				i += zc*2-2;
			}
			else set.push(l, 0);
		}
		return len>>>1;
	}
	function _hufTree(hst, tree, MAXL) {
		var list=[], hl = hst.length, tl=tree.length, i=0;
		for(i=0; i<tl; i+=2) {  tree[i]=0;  tree[i+1]=0;  }	
		for(i=0; i<hl; i++) if(hst[i]!=0) list.push({lit:i, f:hst[i]});
		var end = list.length, l2=list.slice(0);
		if(end==0) return 0;  // empty histogram (usually for dist)
		if(end==1) {  var lit=list[0].lit, l2=lit==0?1:0;  tree[(lit<<1)+1]=1;  tree[(l2<<1)+1]=1;  return 1;  }
		list.sort(function(a,b){return a.f-b.f;});
		var a=list[0], b=list[1], i0=0, i1=1, i2=2;  list[0]={lit:-1,f:a.f+b.f,l:a,r:b,d:0};
		while(i1!=end-1) {
			if(i0!=i1 && (i2==end || list[i0].f<list[i2].f)) {  a=list[i0++];  }  else {  a=list[i2++];  }
			if(i0!=i1 && (i2==end || list[i0].f<list[i2].f)) {  b=list[i0++];  }  else {  b=list[i2++];  }
			list[i1++]={lit:-1,f:a.f+b.f, l:a,r:b};
		}
		var maxl = setDepth(list[i1-1], 0);
		if(maxl>MAXL) {  restrictDepth(l2, MAXL, maxl);  maxl = MAXL;  }
		for(i=0; i<end; i++) tree[(l2[i].lit<<1)+1]=l2[i].d;
		return maxl;
	}

	function setDepth(t, d) {
		if(t.lit!=-1) {  t.d=d;  return d;  }
		return Math.max( setDepth(t.l, d+1),  setDepth(t.r, d+1) );
	}

	function restrictDepth(dps, MD, maxl) {
		var i=0, bCost=1<<(maxl-MD), dbt=0;
		dps.sort(function(a,b){return b.d==a.d ? a.f-b.f : b.d-a.d;});
		
		for(i=0; i<dps.length; i++) if(dps[i].d>MD) {  var od=dps[i].d;  dps[i].d=MD;  dbt+=bCost-(1<<(maxl-od));  }  else break;
		dbt = dbt>>>(maxl-MD);
		while(dbt>0) {  var od=dps[i].d;  if(od<MD) {  dps[i].d++;  dbt-=(1<<(MD-od-1));  }  else  i++;  }
		for(; i>=0; i--) if(dps[i].d==MD && dbt<0) {  dps[i].d--;  dbt++;  }  if(dbt!=0) console.log("debt left");
	}

	function _goodIndex(v, arr) {
		var i=0;  if(arr[i|16]<=v) i|=16;  if(arr[i|8]<=v) i|=8;  if(arr[i|4]<=v) i|=4;  if(arr[i|2]<=v) i|=2;  if(arr[i|1]<=v) i|=1;  return i;
	}
	function _writeLit(ch, ltree, out, pos) {
		_putsF(out, pos, ltree[ch<<1]);
		return pos+ltree[(ch<<1)+1];
	}








	function inflate(data, buf) {
		var u8=Uint8Array;
		if(data[0]==3 && data[1]==0) return (buf ? buf : new u8(0));
		//var F=UZIP.F, bitsF = F._bitsF, bitsE = F._bitsE, decodeTiny = F._decodeTiny, makeCodes = F.makeCodes, codes2map=F.codes2map, get17 = F._get17;
		
		var noBuf = (buf==null);
		if(noBuf) buf = new u8((data.length>>>2)<<3);
		
		var BFINAL=0, BTYPE=0, HLIT=0, HDIST=0, HCLEN=0, ML=0, MD=0; 	
		var off = 0, pos = 0;
		var lmap, dmap;
		
		while(BFINAL==0) {		
			BFINAL = _bitsF(data, pos  , 1);
			BTYPE  = _bitsF(data, pos+1, 2);  pos+=3;
			//console.log(BFINAL, BTYPE);
			
			if(BTYPE==0) {
				if((pos&7)!=0) pos+=8-(pos&7);
				var p8 = (pos>>>3)+4, len = data[p8-4]|(data[p8-3]<<8);  //console.log(len);//bitsF(data, pos, 16), 
				if(noBuf) buf=_check(buf, off+len);
				buf.set(new u8(data.buffer, data.byteOffset+p8, len), off);
				//for(var i=0; i<len; i++) buf[off+i] = data[p8+i];
				//for(var i=0; i<len; i++) if(buf[off+i] != data[p8+i]) throw "e";
				pos = ((p8+len)<<3);  off+=len;  continue;
			}
			if(noBuf) buf=_check(buf, off+(1<<17));  // really not enough in many cases (but PNG and ZIP provide buffer in advance)
			if(BTYPE==1) {  lmap = U.flmap;  dmap = U.fdmap;  ML = (1<<9)-1;  MD = (1<<5)-1;   }
			if(BTYPE==2) {
				HLIT  = _bitsE(data, pos   , 5)+257;  
				HDIST = _bitsE(data, pos+ 5, 5)+  1;  
				HCLEN = _bitsE(data, pos+10, 4)+  4;  pos+=14;
				
				var ppos = pos;
				for(var i=0; i<38; i+=2) {  U.itree[i]=0;  U.itree[i+1]=0;  }
				var tl = 1;
				for(var i=0; i<HCLEN; i++) {  var l=_bitsE(data, pos+i*3, 3);  U.itree[(U.ordr[i]<<1)+1] = l;  if(l>tl)tl=l;  }     pos+=3*HCLEN;  //console.log(itree);
				makeCodes(U.itree, tl);
				codes2map(U.itree, tl, U.imap);
				
				lmap = U.lmap;  dmap = U.dmap;
				
				pos = _decodeTiny(U.imap, (1<<tl)-1, HLIT+HDIST, data, pos, U.ttree);
				var mx0 = _copyOut(U.ttree,    0, HLIT , U.ltree);  ML = (1<<mx0)-1;
				var mx1 = _copyOut(U.ttree, HLIT, HDIST, U.dtree);  MD = (1<<mx1)-1;
				
				//var ml = _decodeTiny(U.imap, (1<<tl)-1, HLIT , data, pos, U.ltree); ML = (1<<(ml>>>24))-1;  pos+=(ml&0xffffff);
				makeCodes(U.ltree, mx0);
				codes2map(U.ltree, mx0, lmap);
				
				//var md = _decodeTiny(U.imap, (1<<tl)-1, HDIST, data, pos, U.dtree); MD = (1<<(md>>>24))-1;  pos+=(md&0xffffff);
				makeCodes(U.dtree, mx1);
				codes2map(U.dtree, mx1, dmap);
			}
			//var ooff=off, opos=pos;
			while(true) {
				var code = lmap[_get17(data, pos) & ML];  pos += code&15;
				var lit = code>>>4;  //U.lhst[lit]++;  
				if((lit>>>8)==0) {  buf[off++] = lit;  }
				else if(lit==256) {  break;  }
				else {
					var end = off+lit-254;
					if(lit>264) { var ebs = U.ldef[lit-257];  end = off + (ebs>>>3) + _bitsE(data, pos, ebs&7);  pos += ebs&7;  }
					//UZIP.F.dst[end-off]++;
					
					var dcode = dmap[_get17(data, pos) & MD];  pos += dcode&15;
					var dlit = dcode>>>4;
					var dbs = U.ddef[dlit], dst = (dbs>>>4) + _bitsF(data, pos, dbs&15);  pos += dbs&15;
					
					//var o0 = off-dst, stp = Math.min(end-off, dst);
					//if(stp>20) while(off<end) {  buf.copyWithin(off, o0, o0+stp);  off+=stp;  }  else
					//if(end-dst<=off) buf.copyWithin(off, off-dst, end-dst);  else
					//if(dst==1) buf.fill(buf[off-1], off, end);  else
					if(noBuf) buf=_check(buf, off+(1<<17));
					while(off<end) {  buf[off]=buf[off++-dst];    buf[off]=buf[off++-dst];  buf[off]=buf[off++-dst];  buf[off]=buf[off++-dst];  }   
					off=end;
					//while(off!=end) {  buf[off]=buf[off++-dst];  }
				}
			}
			//console.log(off-ooff, (pos-opos)>>>3);
		}
		//console.log(UZIP.F.dst);
		//console.log(tlen, dlen, off-tlen+tcnt);
		return buf.length==off ? buf : buf.slice(0,off);
	}
	function _check(buf, len) {
		var bl=buf.length;  if(len<=bl) return buf;
		var nbuf = new Uint8Array(Math.max(bl<<1,len));  nbuf.set(buf,0);
		//for(var i=0; i<bl; i+=4) {  nbuf[i]=buf[i];  nbuf[i+1]=buf[i+1];  nbuf[i+2]=buf[i+2];  nbuf[i+3]=buf[i+3];  }
		return nbuf;
	}

	function _decodeTiny(lmap, LL, len, data, pos, tree) {
		//var bitsE = UZIP.F._bitsE, get17 = UZIP.F._get17;
		var i = 0;
		while(i<len) {
			var code = lmap[_get17(data, pos)&LL];  pos+=code&15;
			var lit = code>>>4; 
			if(lit<=15) {  tree[i]=lit;  i++;  }
			else {
				var ll = 0, n = 0;
				if(lit==16) {
					n = (3  + _bitsE(data, pos, 2));  pos += 2;  ll = tree[i-1];
				}
				else if(lit==17) {
					n = (3  + _bitsE(data, pos, 3));  pos += 3;
				}
				else if(lit==18) {
					n = (11 + _bitsE(data, pos, 7));  pos += 7;
				}
				var ni = i+n;
				while(i<ni) {  tree[i]=ll;  i++; }
			}
		}
		return pos;
	}
	function _copyOut(src, off, len, tree) {
		var mx=0, i=0, tl=tree.length>>>1;
		while(i<len) {  var v=src[i+off];  tree[(i<<1)]=0;  tree[(i<<1)+1]=v;  if(v>mx)mx=v;  i++;  }
		while(i<tl ) {  tree[(i<<1)]=0;  tree[(i<<1)+1]=0;  i++;  }
		return mx;
	}

	UZIP["F"]={"inflate":inflate, "deflateRaw":deflateRaw};
	
})();

