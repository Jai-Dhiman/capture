#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const wasmJsPath = join(process.cwd(), '../wasm/capture_wasm.js');

try {
  let content = readFileSync(wasmJsPath, 'utf-8');
  
  // Replace the env import with proper environment bindings
  content = content.replace(
    "import * as __wbg_star0 from 'env';",
    `// Environment bindings for Ring crypto and other native functions
const __wbg_star0 = {
  // Ring crypto bindings (empty implementations for WebAssembly environment)
  GFp_memcmp: () => { throw new Error('Ring crypto not supported in WebAssembly'); },
  GFp_check_pk: () => { throw new Error('Ring crypto not supported in WebAssembly'); },
  
  // Console functions that might be needed
  __wbindgen_throw: function(arg0, arg1) {
    throw new Error('WASM error: ' + arg0 + ', ' + arg1);
  }
};`
  );
  
  // Keep the env import but use our custom bindings
  content = content.replace(
    "imports['env'] = __wbg_star0;",
    `// Use custom environment bindings including Ring crypto stubs
imports['env'] = __wbg_star0;`
  );
  
  writeFileSync(wasmJsPath, content);
  console.log('✅ Fixed WASM env import bindings with Ring crypto stubs');
} catch (error) {
  console.error('❌ Failed to fix WASM imports:', error.message);
  process.exit(1);
} 