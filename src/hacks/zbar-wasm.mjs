/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P
            ? value
            : new P(function (resolve) {
                  resolve(value);
              });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator['throw'](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done
                ? resolve(result.value)
                : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === 'function'
    ? SuppressedError
    : function (error, suppressed, message) {
          var e = new Error(message);
          return (
              (e.name = 'SuppressedError'),
              (e.error = error),
              (e.suppressed = suppressed),
              e
          );
      };

var zbarWasm = (() => {
    var _scriptDir = import.meta.url;

    return async function (moduleArg = {}) {
        var Module = moduleArg;
        var readyPromiseResolve, readyPromiseReject;
        Module['ready'] = new Promise((resolve, reject) => {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
        });
        var moduleOverrides = Object.assign({}, Module);
        var ENVIRONMENT_IS_WEB = typeof window == 'object';
        var ENVIRONMENT_IS_WORKER = typeof importScripts == 'function';
        var ENVIRONMENT_IS_NODE =
            typeof process == 'object' &&
            typeof process.versions == 'object' &&
            typeof process.versions.node == 'string';
        var scriptDirectory = '';
        function locateFile(path) {
            if (Module['locateFile']) {
                return Module['locateFile'](path, scriptDirectory);
            }
            return scriptDirectory + path;
        }
        var read_, readAsync, readBinary;
        if (ENVIRONMENT_IS_NODE) {
            const { createRequire: createRequire } =
                await Promise.resolve().then(() => _polyfillNode_module);
            var require = createRequire(import.meta.url);
            var fs = require('fs');
            var nodePath = require('path');
            if (ENVIRONMENT_IS_WORKER) {
                scriptDirectory = nodePath.dirname(scriptDirectory) + '/';
            } else {
                scriptDirectory = require('url').fileURLToPath(
                    new URL('./', import.meta.url)
                );
            }
            read_ = (filename, binary) => {
                filename = isFileURI(filename)
                    ? new URL(filename)
                    : nodePath.normalize(filename);
                return fs.readFileSync(filename, binary ? undefined : 'utf8');
            };
            readBinary = (filename) => {
                var ret = read_(filename, true);
                if (!ret.buffer) {
                    ret = new Uint8Array(ret);
                }
                return ret;
            };
            readAsync = (filename, onload, onerror, binary = true) => {
                filename = isFileURI(filename)
                    ? new URL(filename)
                    : nodePath.normalize(filename);
                fs.readFile(
                    filename,
                    binary ? undefined : 'utf8',
                    (err, data) => {
                        if (err) onerror(err);
                        else onload(binary ? data.buffer : data);
                    }
                );
            };
            if (!Module['thisProgram'] && process.argv.length > 1) {
                process.argv[1].replace(/\\/g, '/');
            }
            process.argv.slice(2);
            Module['inspect'] = () => '[Emscripten Module object]';
        } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
            if (ENVIRONMENT_IS_WORKER) {
                scriptDirectory = self.location.href;
            } else if (
                typeof document != 'undefined' &&
                document.currentScript
            ) {
                scriptDirectory = document.currentScript.src;
            }
            if (_scriptDir) {
                scriptDirectory = _scriptDir;
            }
            if (scriptDirectory.indexOf('blob:') !== 0) {
                scriptDirectory = scriptDirectory.substr(
                    0,
                    scriptDirectory.replace(/[?#].*/, '').lastIndexOf('/') + 1
                );
            } else {
                scriptDirectory = '';
            }
            {
                read_ = (url) => {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', url, false);
                    xhr.send(null);
                    return xhr.responseText;
                };
                if (ENVIRONMENT_IS_WORKER) {
                    readBinary = (url) => {
                        var xhr = new XMLHttpRequest();
                        xhr.open('GET', url, false);
                        xhr.responseType = 'arraybuffer';
                        xhr.send(null);
                        return new Uint8Array(xhr.response);
                    };
                }
                readAsync = (url, onload, onerror) => {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', url, true);
                    xhr.responseType = 'arraybuffer';
                    xhr.onload = () => {
                        if (
                            xhr.status == 200 ||
                            (xhr.status == 0 && xhr.response)
                        ) {
                            onload(xhr.response);
                            return;
                        }
                        onerror();
                    };
                    xhr.onerror = onerror;
                    xhr.send(null);
                };
            }
        } else;
        var out = Module['print'] || console.log.bind(console);
        var err = Module['printErr'] || console.error.bind(console);
        Object.assign(Module, moduleOverrides);
        moduleOverrides = null;
        if (Module['arguments']) Module['arguments'];
        if (Module['thisProgram']) Module['thisProgram'];
        if (Module['quit']) Module['quit'];
        var wasmBinary;
        if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
        Module['noExitRuntime'] || true;
        if (typeof WebAssembly != 'object') {
            abort('no native wasm support detected');
        }
        var wasmMemory;
        var wasmExports;
        var ABORT = false;
        var HEAPU8, HEAPU32;
        function updateMemoryViews() {
            var b = wasmMemory.buffer;
            Module['HEAP8'] = new Int8Array(b);
            Module['HEAP16'] = new Int16Array(b);
            Module['HEAP32'] = new Int32Array(b);
            Module['HEAPU8'] = HEAPU8 = new Uint8Array(b);
            Module['HEAPU16'] = new Uint16Array(b);
            Module['HEAPU32'] = HEAPU32 = new Uint32Array(b);
            Module['HEAPF32'] = new Float32Array(b);
            Module['HEAPF64'] = new Float64Array(b);
        }
        var __ATPRERUN__ = [];
        var __ATINIT__ = [];
        var __ATPOSTRUN__ = [];
        function preRun() {
            if (Module['preRun']) {
                if (typeof Module['preRun'] == 'function')
                    Module['preRun'] = [Module['preRun']];
                while (Module['preRun'].length) {
                    addOnPreRun(Module['preRun'].shift());
                }
            }
            callRuntimeCallbacks(__ATPRERUN__);
        }
        function initRuntime() {
            callRuntimeCallbacks(__ATINIT__);
        }
        function postRun() {
            if (Module['postRun']) {
                if (typeof Module['postRun'] == 'function')
                    Module['postRun'] = [Module['postRun']];
                while (Module['postRun'].length) {
                    addOnPostRun(Module['postRun'].shift());
                }
            }
            callRuntimeCallbacks(__ATPOSTRUN__);
        }
        function addOnPreRun(cb) {
            __ATPRERUN__.unshift(cb);
        }
        function addOnInit(cb) {
            __ATINIT__.unshift(cb);
        }
        function addOnPostRun(cb) {
            __ATPOSTRUN__.unshift(cb);
        }
        var runDependencies = 0;
        var dependenciesFulfilled = null;
        function addRunDependency(id) {
            runDependencies++;
            if (Module['monitorRunDependencies']) {
                Module['monitorRunDependencies'](runDependencies);
            }
        }
        function removeRunDependency(id) {
            runDependencies--;
            if (Module['monitorRunDependencies']) {
                Module['monitorRunDependencies'](runDependencies);
            }
            if (runDependencies == 0) {
                if (dependenciesFulfilled) {
                    var callback = dependenciesFulfilled;
                    dependenciesFulfilled = null;
                    callback();
                }
            }
        }
        function abort(what) {
            if (Module['onAbort']) {
                Module['onAbort'](what);
            }
            what = 'Aborted(' + what + ')';
            err(what);
            ABORT = true;
            what += '. Build with -sASSERTIONS for more info.';
            var e = new WebAssembly.RuntimeError(what);
            readyPromiseReject(e);
            throw e;
        }
        var dataURIPrefix = 'data:application/octet-stream;base64,';
        function isDataURI(filename) {
            return filename.startsWith(dataURIPrefix);
        }
        function isFileURI(filename) {
            return filename.startsWith('file://');
        }
        var wasmBinaryFile = '/zbar.wasm';
        if (Module['locateFile']) {
            if (!isDataURI(wasmBinaryFile)) {
                wasmBinaryFile = locateFile(wasmBinaryFile);
            }
        } else {
            wasmBinaryFile = new URL(wasmBinaryFile, import.meta.url).href;
        }
        function getBinarySync(file) {
            if (file == wasmBinaryFile && wasmBinary) {
                return new Uint8Array(wasmBinary);
            }
            if (readBinary) {
                return readBinary(file);
            }
            throw 'both async and sync fetching of the wasm failed';
        }
        function getBinaryPromise(binaryFile) {
            if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
                if (typeof fetch == 'function' && !isFileURI(binaryFile)) {
                    return fetch(binaryFile, { credentials: 'same-origin' })
                        .then((response) => {
                            if (!response['ok']) {
                                throw (
                                    "failed to load wasm binary file at '" +
                                    binaryFile +
                                    "'"
                                );
                            }
                            return response['arrayBuffer']();
                        })
                        .catch(() => getBinarySync(binaryFile));
                } else if (readAsync) {
                    return new Promise((resolve, reject) => {
                        readAsync(
                            binaryFile,
                            (response) => resolve(new Uint8Array(response)),
                            reject
                        );
                    });
                }
            }
            return Promise.resolve().then(() => getBinarySync(binaryFile));
        }
        function instantiateArrayBuffer(binaryFile, imports, receiver) {
            return getBinaryPromise(binaryFile)
                .then((binary) => WebAssembly.instantiate(binary, imports))
                .then((instance) => instance)
                .then(receiver, (reason) => {
                    err('failed to asynchronously prepare wasm: ' + reason);
                    abort(reason);
                });
        }
        function instantiateAsync(binary, binaryFile, imports, callback) {
            if (
                !binary &&
                typeof WebAssembly.instantiateStreaming == 'function' &&
                !isDataURI(binaryFile) &&
                !isFileURI(binaryFile) &&
                !ENVIRONMENT_IS_NODE &&
                typeof fetch == 'function'
            ) {
                return fetch(binaryFile, { credentials: 'same-origin' }).then(
                    (response) => {
                        var result = WebAssembly.instantiateStreaming(
                            response,
                            imports
                        );
                        return result.then(callback, function (reason) {
                            err('wasm streaming compile failed: ' + reason);
                            err('falling back to ArrayBuffer instantiation');
                            return instantiateArrayBuffer(
                                binaryFile,
                                imports,
                                callback
                            );
                        });
                    }
                );
            }
            return instantiateArrayBuffer(binaryFile, imports, callback);
        }
        function createWasm() {
            var info = { a: wasmImports };
            function receiveInstance(instance, module) {
                var exports = instance.exports;
                wasmExports = exports;
                wasmMemory = wasmExports['g'];
                updateMemoryViews();
                wasmExports['s'];
                addOnInit(wasmExports['h']);
                removeRunDependency();
                return exports;
            }
            addRunDependency();
            function receiveInstantiationResult(result) {
                receiveInstance(result['instance']);
            }
            if (Module['instantiateWasm']) {
                try {
                    return Module['instantiateWasm'](info, receiveInstance);
                } catch (e) {
                    err(
                        'Module.instantiateWasm callback failed with error: ' +
                            e
                    );
                    readyPromiseReject(e);
                }
            }
            instantiateAsync(
                wasmBinary,
                wasmBinaryFile,
                info,
                receiveInstantiationResult
            ).catch(readyPromiseReject);
            return {};
        }
        var callRuntimeCallbacks = (callbacks) => {
            while (callbacks.length > 0) {
                callbacks.shift()(Module);
            }
        };
        var nowIsMonotonic = true;
        var __emscripten_get_now_is_monotonic = () => nowIsMonotonic;
        function _emscripten_date_now() {
            return Date.now();
        }
        var getHeapMax = () => 2147483648;
        var growMemory = (size) => {
            var b = wasmMemory.buffer;
            var pages = (size - b.byteLength + 65535) >>> 16;
            try {
                wasmMemory.grow(pages);
                updateMemoryViews();
                return 1;
            } catch (e) {}
        };
        var _emscripten_resize_heap = (requestedSize) => {
            var oldSize = HEAPU8.length;
            requestedSize >>>= 0;
            var maxHeapSize = getHeapMax();
            if (requestedSize > maxHeapSize) {
                return false;
            }
            var alignUp = (x, multiple) =>
                x + ((multiple - (x % multiple)) % multiple);
            for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
                var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
                overGrownHeapSize = Math.min(
                    overGrownHeapSize,
                    requestedSize + 100663296
                );
                var newSize = Math.min(
                    maxHeapSize,
                    alignUp(Math.max(requestedSize, overGrownHeapSize), 65536)
                );
                var replacement = growMemory(newSize);
                if (replacement) {
                    return true;
                }
            }
            return false;
        };
        var UTF8Decoder =
            typeof TextDecoder != 'undefined'
                ? new TextDecoder('utf8')
                : undefined;
        var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
            var endIdx = idx + maxBytesToRead;
            var endPtr = idx;
            while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
            if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
                return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
            }
            var str = '';
            while (idx < endPtr) {
                var u0 = heapOrArray[idx++];
                if (!(u0 & 128)) {
                    str += String.fromCharCode(u0);
                    continue;
                }
                var u1 = heapOrArray[idx++] & 63;
                if ((u0 & 224) == 192) {
                    str += String.fromCharCode(((u0 & 31) << 6) | u1);
                    continue;
                }
                var u2 = heapOrArray[idx++] & 63;
                if ((u0 & 240) == 224) {
                    u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
                } else {
                    u0 =
                        ((u0 & 7) << 18) |
                        (u1 << 12) |
                        (u2 << 6) |
                        (heapOrArray[idx++] & 63);
                }
                if (u0 < 65536) {
                    str += String.fromCharCode(u0);
                } else {
                    var ch = u0 - 65536;
                    str += String.fromCharCode(
                        55296 | (ch >> 10),
                        56320 | (ch & 1023)
                    );
                }
            }
            return str;
        };
        var _fd_close = (fd) => 52;
        function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
            return 70;
        }
        var printCharBuffers = [null, [], []];
        var printChar = (stream, curr) => {
            var buffer = printCharBuffers[stream];
            if (curr === 0 || curr === 10) {
                (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
                buffer.length = 0;
            } else {
                buffer.push(curr);
            }
        };
        var _fd_write = (fd, iov, iovcnt, pnum) => {
            var num = 0;
            for (var i = 0; i < iovcnt; i++) {
                var ptr = HEAPU32[iov >> 2];
                var len = HEAPU32[(iov + 4) >> 2];
                iov += 8;
                for (var j = 0; j < len; j++) {
                    printChar(fd, HEAPU8[ptr + j]);
                }
                num += len;
            }
            HEAPU32[pnum >> 2] = num;
            return 0;
        };
        var wasmImports = {
            d: __emscripten_get_now_is_monotonic,
            e: _emscripten_date_now,
            c: _emscripten_resize_heap,
            f: _fd_close,
            b: _fd_seek,
            a: _fd_write,
        };
        createWasm();
        Module['ImageScanner_create'] = () =>
            (Module['ImageScanner_create'] = wasmExports['i'])();
        Module['ImageScanner_destory'] = (a0) =>
            (Module['ImageScanner_destory'] = wasmExports['j'])(a0);
        Module['ImageScanner_set_config'] = (a0, a1, a2, a3) =>
            (Module['ImageScanner_set_config'] = wasmExports['k'])(
                a0,
                a1,
                a2,
                a3
            );
        Module['ImageScanner_enable_cache'] = (a0, a1) =>
            (Module['ImageScanner_enable_cache'] = wasmExports['l'])(a0, a1);
        Module['ImageScanner_recycleimage'] = (a0, a1) =>
            (Module['ImageScanner_recycle_image'] = wasmExports['m'])(a0, a1);
        Module['ImageScanner_get_results'] = (a0) =>
            (Module['ImageScanner_get_results'] = wasmExports['n'])(a0);
        Module['ImageScanner_scan'] = (a0, a1) =>
            (Module['ImageScanner_scan'] = wasmExports['o'])(a0, a1);
        Module['Image_create'] = (a0, a1, a2, a3, a4, a5) =>
            (Module['Image_create'] = wasmExports['p'])(
                a0,
                a1,
                a2,
                a3,
                a4,
                a5
            );
        Module['Image_destory'] = (a0) =>
            (Module['Image_destory'] = wasmExports['q'])(a0);
        Module['Image_get_symbols'] = (a0) =>
            (Module['Image_get_symbols'] = wasmExports['r'])(a0);
        Module['free'] = (a0) => (Module['free'] = wasmExports['t'])(a0);
        Module['malloc'] = (a0) => (Module['malloc'] = wasmExports['u'])(a0);
        var calledRun;
        dependenciesFulfilled = function runCaller() {
            if (!calledRun) run();
            if (!calledRun) dependenciesFulfilled = runCaller;
        };
        function run() {
            if (runDependencies > 0) {
                return;
            }
            preRun();
            if (runDependencies > 0) {
                return;
            }
            function doRun() {
                if (calledRun) return;
                calledRun = true;
                Module['calledRun'] = true;
                if (ABORT) return;
                initRuntime();
                readyPromiseResolve(Module);
                if (Module['onRuntimeInitialized'])
                    Module['onRuntimeInitialized']();
                postRun();
            }
            if (Module['setStatus']) {
                Module['setStatus']('Running...');
                setTimeout(function () {
                    setTimeout(function () {
                        Module['setStatus']('');
                    }, 1);
                    doRun();
                }, 1);
            } else {
                doRun();
            }
        }
        if (Module['preInit']) {
            if (typeof Module['preInit'] == 'function')
                Module['preInit'] = [Module['preInit']];
            while (Module['preInit'].length > 0) {
                Module['preInit'].pop()();
            }
        }
        run();

        return moduleArg.ready;
    };
})();

let zbarInstance;
const zbarInstancePromise = (() =>
    __awaiter(void 0, void 0, void 0, function* () {
        zbarInstance = yield zbarWasm();
        if (!zbarInstance) {
            throw Error('WASM was not loaded');
        }
        return zbarInstance;
    }))();
const getInstance = () =>
    __awaiter(void 0, void 0, void 0, function* () {
        return yield zbarInstancePromise;
    });

/* Copied from https://github.com/mchehab/zbar, release 0.23.90 */
var ZBarSymbolType;
(function (ZBarSymbolType) {
    ZBarSymbolType[(ZBarSymbolType['ZBAR_NONE'] = 0)] = 'ZBAR_NONE';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_PARTIAL'] = 1)] = 'ZBAR_PARTIAL';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_EAN2'] = 2)] = 'ZBAR_EAN2';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_EAN5'] = 5)] = 'ZBAR_EAN5';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_EAN8'] = 8)] = 'ZBAR_EAN8';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_UPCE'] = 9)] = 'ZBAR_UPCE';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_ISBN10'] = 10)] = 'ZBAR_ISBN10';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_UPCA'] = 12)] = 'ZBAR_UPCA';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_EAN13'] = 13)] = 'ZBAR_EAN13';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_ISBN13'] = 14)] = 'ZBAR_ISBN13';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_COMPOSITE'] = 15)] = 'ZBAR_COMPOSITE';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_I25'] = 25)] = 'ZBAR_I25';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_DATABAR'] = 34)] = 'ZBAR_DATABAR';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_DATABAR_EXP'] = 35)] =
        'ZBAR_DATABAR_EXP';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_CODABAR'] = 38)] = 'ZBAR_CODABAR';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_CODE39'] = 39)] = 'ZBAR_CODE39';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_PDF417'] = 57)] = 'ZBAR_PDF417';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_QRCODE'] = 64)] = 'ZBAR_QRCODE';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_SQCODE'] = 80)] = 'ZBAR_SQCODE';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_CODE93'] = 93)] = 'ZBAR_CODE93';
    ZBarSymbolType[(ZBarSymbolType['ZBAR_CODE128'] = 128)] = 'ZBAR_CODE128';
    /*
     * Please see _zbar_get_symbol_hash() if adding
     * anything after 128
     */
    /** mask for base symbol type.
     * @deprecated in 0.11, remove this from existing code
     */
    ZBarSymbolType[(ZBarSymbolType['ZBAR_SYMBOL'] = 255)] = 'ZBAR_SYMBOL';
    /** 2-digit add-on flag.
     * @deprecated in 0.11, a ::ZBAR_EAN2 component is used for
     * 2-digit GS1 add-ons
     */
    ZBarSymbolType[(ZBarSymbolType['ZBAR_ADDON2'] = 512)] = 'ZBAR_ADDON2';
    /** 5-digit add-on flag.
     * @deprecated in 0.11, a ::ZBAR_EAN5 component is used for
     * 5-digit GS1 add-ons
     */
    ZBarSymbolType[(ZBarSymbolType['ZBAR_ADDON5'] = 1280)] = 'ZBAR_ADDON5';
    /** add-on flag mask.
     * @deprecated in 0.11, GS1 add-ons are represented using composite
     * symbols of type ::ZBAR_COMPOSITE; add-on components use ::ZBAR_EAN2
     * or ::ZBAR_EAN5
     */
    ZBarSymbolType[(ZBarSymbolType['ZBAR_ADDON'] = 1792)] = 'ZBAR_ADDON';
})(ZBarSymbolType || (ZBarSymbolType = {}));
var ZBarConfigType;
(function (ZBarConfigType) {
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_ENABLE'] = 0)] = 'ZBAR_CFG_ENABLE';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_ADD_CHECK'] = 1)] =
        'ZBAR_CFG_ADD_CHECK';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_EMIT_CHECK'] = 2)] =
        'ZBAR_CFG_EMIT_CHECK';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_ASCII'] = 3)] = 'ZBAR_CFG_ASCII';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_BINARY'] = 4)] = 'ZBAR_CFG_BINARY';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_NUM'] = 5)] = 'ZBAR_CFG_NUM';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_MIN_LEN'] = 32)] =
        'ZBAR_CFG_MIN_LEN';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_MAX_LEN'] = 33)] =
        'ZBAR_CFG_MAX_LEN';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_UNCERTAINTY'] = 64)] =
        'ZBAR_CFG_UNCERTAINTY';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_POSITION'] = 128)] =
        'ZBAR_CFG_POSITION';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_TEST_INVERTED'] = 129)] =
        'ZBAR_CFG_TEST_INVERTED';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_X_DENSITY'] = 256)] =
        'ZBAR_CFG_X_DENSITY';
    ZBarConfigType[(ZBarConfigType['ZBAR_CFG_Y_DENSITY'] = 257)] =
        'ZBAR_CFG_Y_DENSITY';
})(ZBarConfigType || (ZBarConfigType = {}));
var ZBarOrientation;
(function (ZBarOrientation) {
    ZBarOrientation[(ZBarOrientation['ZBAR_ORIENT_UNKNOWN'] = -1)] =
        'ZBAR_ORIENT_UNKNOWN';
    ZBarOrientation[(ZBarOrientation['ZBAR_ORIENT_UP'] = 0)] = 'ZBAR_ORIENT_UP';
    ZBarOrientation[(ZBarOrientation['ZBAR_ORIENT_RIGHT'] = 1)] =
        'ZBAR_ORIENT_RIGHT';
    ZBarOrientation[(ZBarOrientation['ZBAR_ORIENT_DOWN'] = 2)] =
        'ZBAR_ORIENT_DOWN';
    ZBarOrientation[(ZBarOrientation['ZBAR_ORIENT_LEFT'] = 3)] =
        'ZBAR_ORIENT_LEFT';
})(ZBarOrientation || (ZBarOrientation = {}));

class CppObject {
    constructor(ptr, inst) {
        this.ptr = ptr;
        this.inst = inst;
    }
    checkAlive() {
        if (this.ptr) return;
        throw Error('Call after destroyed');
    }
    getPointer() {
        this.checkAlive();
        return this.ptr;
    }
}

class TypePointer {
    constructor(ptr, buf) {
        this.ptr = ptr;
        this.ptr32 = ptr >> 2;
        this.buf = buf;
        this.HEAP8 = new Int8Array(buf);
        this.HEAPU32 = new Uint32Array(buf);
        this.HEAP32 = new Int32Array(buf);
    }
}
class SymbolPtr extends TypePointer {
    get type() {
        return this.HEAPU32[this.ptr32];
    }
    get data() {
        const len = this.HEAPU32[this.ptr32 + 4],
            ptr = this.HEAPU32[this.ptr32 + 5];
        return Int8Array.from(this.HEAP8.subarray(ptr, ptr + len));
    }
    get points() {
        const len = this.HEAPU32[this.ptr32 + 7],
            ptr = this.HEAPU32[this.ptr32 + 8],
            ptr32 = ptr >> 2,
            res = [];
        for (let i = 0; i < len; ++i) {
            const x = this.HEAP32[ptr32 + i * 2],
                y = this.HEAP32[ptr32 + i * 2 + 1];
            res.push({ x, y });
        }
        return res;
    }
    get orientation() {
        return this.HEAP32[this.ptr32 + 9];
    }
    get next() {
        const ptr = this.HEAPU32[this.ptr32 + 11];
        if (!ptr) return null;
        return new SymbolPtr(ptr, this.buf);
    }
    get time() {
        return this.HEAPU32[this.ptr32 + 13];
    }
    get cacheCount() {
        return this.HEAP32[this.ptr32 + 14];
    }
    get quality() {
        return this.HEAP32[this.ptr32 + 15];
    }
}
class SymbolSetPtr extends TypePointer {
    get head() {
        const ptr = this.HEAPU32[this.ptr32 + 2];
        if (!ptr) return null;
        return new SymbolPtr(ptr, this.buf);
    }
}
class ZBarSymbol {
    constructor(ptr) {
        this.type = ptr.type;
        this.typeName = ZBarSymbolType[this.type];
        this.data = ptr.data;
        this.points = ptr.points;
        this.orientation = ptr.orientation;
        this.time = ptr.time;
        this.cacheCount = ptr.cacheCount;
        this.quality = ptr.quality;
    }
    static createSymbolsFromPtr(ptr, buf) {
        if (ptr == 0) return [];
        const set = new SymbolSetPtr(ptr, buf);
        let symbol = set.head;
        const res = [];
        while (symbol !== null) {
            res.push(new ZBarSymbol(symbol));
            symbol = symbol.next;
        }
        return res;
    }
    decode(encoding) {
        const decoder = new TextDecoder(encoding);
        return decoder.decode(this.data);
    }
}

class ZBarImage extends CppObject {
    static createFromGrayBuffer(width, height, dataBuf, sequence_num = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const inst = yield getInstance(),
                data = new Uint8Array(dataBuf),
                len = width * height;
            if (len !== data.byteLength) {
                throw Error(
                    `data length (${data.byteLength} bytes) does not match width and height (${len} bytes)`
                );
            }
            const buf = inst.malloc(len),
                heap = inst.HEAPU8;
            heap.set(data, buf);
            const ptr = inst.Image_create(
                width,
                height,
                0x30303859 /* Y800 */,
                buf,
                len,
                sequence_num
            );
            return new this(ptr, inst);
        });
    }
    static createFromRGBABuffer(width, height, dataBuf, sequence_num = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const inst = yield getInstance(),
                data = new Uint8Array(dataBuf),
                len = width * height;
            if (len * 4 !== data.byteLength) {
                throw Error(
                    `data length (${
                        data.byteLength
                    } bytes) does not match width and height (${len * 4} bytes)`
                );
            }
            const buf = inst.malloc(len),
                bufEnd = buf + len,
                heap = inst.HEAPU8;
            for (let i = buf, j = 0; i < bufEnd; i++, j += 4) {
                heap[i] =
                    (data[j] * 19595 +
                        data[j + 1] * 38469 +
                        data[j + 2] * 7472) >>
                    16;
            }
            const ptr = inst.Image_create(
                width,
                height,
                0x30303859 /* Y800 */,
                buf,
                len,
                sequence_num
            );
            return new this(ptr, inst);
        });
    }
    destroy() {
        this.checkAlive();
        this.inst.Image_destory(this.ptr);
        this.ptr = 0;
    }
    getSymbols() {
        this.checkAlive();
        const res = this.inst.Image_get_symbols(this.ptr);
        return ZBarSymbol.createSymbolsFromPtr(res, this.inst.HEAPU8.buffer);
    }
}

class ZBarScanner extends CppObject {
    static create() {
        return __awaiter(this, void 0, void 0, function* () {
            const inst = yield getInstance(),
                ptr = inst.ImageScanner_create();
            return new this(ptr, inst);
        });
    }
    destroy() {
        this.checkAlive();
        this.inst.ImageScanner_destory(this.ptr);
        this.ptr = 0;
    }
    setConfig(sym, conf, value) {
        this.checkAlive();
        return this.inst.ImageScanner_set_config(this.ptr, sym, conf, value);
    }
    enableCache(enable = true) {
        this.checkAlive();
        this.inst.ImageScanner_enable_cache(this.ptr, enable);
    }
    recycleImage(image) {
        this.checkAlive();
        this.inst.ImageScanner_recycle_image(this.ptr, image.getPointer());
    }
    getResults() {
        this.checkAlive();
        const res = this.inst.ImageScanner_get_results(this.ptr);
        return ZBarSymbol.createSymbolsFromPtr(res, this.inst.HEAPU8.buffer);
    }
    scan(image) {
        this.checkAlive();
        return this.inst.ImageScanner_scan(this.ptr, image.getPointer());
    }
}

// Returns a new ZBarScanner instance that delegates QR code text decoding
// to the native TextDecoder (fixes #7: Issue with utf-8)
const getDefaultScanner = () =>
    __awaiter(void 0, void 0, void 0, function* () {
        const scanner = yield ZBarScanner.create();
        scanner.setConfig(
            ZBarSymbolType.ZBAR_NONE,
            ZBarConfigType.ZBAR_CFG_BINARY,
            1
        );
        return scanner;
    });
let defaultScanner;
const scanImage = (image, scanner) =>
    __awaiter(void 0, void 0, void 0, function* () {
        if (scanner === undefined) {
            // Create the default scanner lazily
            scanner = defaultScanner || (yield getDefaultScanner());
            defaultScanner = scanner;
        }
        const res = scanner.scan(image);
        if (res < 0) {
            throw Error('Scan Failed');
        }
        if (res === 0) return [];
        return image.getSymbols();
    });
const scanGrayBuffer = (buffer, width, height, scanner) =>
    __awaiter(void 0, void 0, void 0, function* () {
        const image = yield ZBarImage.createFromGrayBuffer(
                width,
                height,
                buffer
            ),
            res = yield scanImage(image, scanner);
        image.destroy();
        return res;
    });
const scanRGBABuffer = (buffer, width, height, scanner) =>
    __awaiter(void 0, void 0, void 0, function* () {
        const image = yield ZBarImage.createFromRGBABuffer(
                width,
                height,
                buffer
            ),
            res = yield scanImage(image, scanner);
        image.destroy();
        return res;
    });
const scanImageData = (image, scanner) =>
    __awaiter(void 0, void 0, void 0, function* () {
        return yield scanRGBABuffer(
            image.data.buffer,
            image.width,
            image.height,
            scanner
        );
    });

const _polyfillNode_module = /*#__PURE__*/ Object.freeze(
    /*#__PURE__*/ Object.defineProperty(
        {
            __proto__: null,
        },
        Symbol.toStringTag,
        { value: 'Module' }
    )
);

export {
    ZBarConfigType,
    ZBarImage,
    ZBarOrientation,
    ZBarScanner,
    ZBarSymbol,
    ZBarSymbolType,
    getDefaultScanner,
    getInstance,
    scanGrayBuffer,
    scanImageData,
    scanRGBABuffer,
};
