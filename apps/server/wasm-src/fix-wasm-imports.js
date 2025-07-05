#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const wasmJsPath = join(process.cwd(), '../wasm/capture_wasm.js');

try {
  let content = readFileSync(wasmJsPath, 'utf-8');
  
  // Replace the env import with the relative path
  content = content.replace(
    "import * as __wbg_star0 from 'env';",
    "import * as __wbg_star0 from './env.js';"
  );
  
  writeFileSync(wasmJsPath, content);
  console.log('✅ Fixed WASM env import path');
} catch (error) {
  console.error('❌ Failed to fix WASM imports:', error.message);
  process.exit(1);
} 