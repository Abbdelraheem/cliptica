#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// CLI argument or environment
let apiKey = process.argv[2]?.trim();

if (!apiKey) {
  // Try loading from .env or .env.production
  const envPaths = ['.env.production', '.env.local', '.env'];
  for (const envFile of envPaths) {
    if (fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, 'utf8').split('\n');
      for (const line of lines) {
        const match = line.match(/^GROQ_API_KEY=(.+)$/);
        if (match) {
          apiKey = match[1].trim().replace(/^["']|["']$/g, '');
          console.log(`Found GROQ_API_KEY in ${envFile}`);
          break;
        }
      }
    }
    if (apiKey) break;
  }
}

if (!apiKey) {
  console.error('\x1b[31m[ERROR]\x1b[0m No Groq API key found. Pass it as an argument:');
  console.error('  node scripts/test-ai.mjs <gsk_...>');
  process.exit(1);
}

const masked = apiKey.length > 10 ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : '***';
console.log(`\x1b[36m[AI Test]\x1b[0m Testing Groq API Key: ${masked}`);

async function runTests() {
  const t0 = Date.now();
  console.log('\x1b[90m1. Querying Groq /v1/models endpoint...\x1b[0m');
  
  try {
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    
    const latency = Date.now() - t0;
    
    if (!modelsRes.ok) {
      const err = await modelsRes.text();
      console.error(`\x1b[31m[FAIL]\x1b[0m Models request failed (${modelsRes.status}): ${err}`);
      process.exit(1);
    }
    
    const modelsData = await modelsRes.json();
    const ids = (modelsData.data || []).map(m => m.id);
    console.log(`\x1b[32m[PASS]\x1b[0m Models endpoint OK in ${latency}ms (${ids.length} models available)`);
    console.log(`  - whisper-large-v3: ${ids.includes('whisper-large-v3') ? 'AVAILABLE' : 'MISSING'}`);
    console.log(`  - llama-3.3-70b-versatile: ${ids.includes('llama-3.3-70b-versatile') ? 'AVAILABLE' : 'MISSING'}`);

    console.log('\x1b[90m2. Querying Groq chat completion (llama-3.3-70b-versatile)...\x1b[0m');
    const c0 = Date.now();
    const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Reply with the word READY' }],
        max_tokens: 10,
      }),
    });
    
    const chatLatency = Date.now() - c0;
    if (!chatRes.ok) {
      const err = await chatRes.text();
      console.error(`\x1b[31m[FAIL]\x1b[0m Chat completion failed (${chatRes.status}): ${err}`);
      process.exit(1);
    }
    
    const chatData = await chatRes.json();
    const reply = chatData.choices?.[0]?.message?.content?.trim();
    console.log(`\x1b[32m[PASS]\x1b[0m Chat completion OK in ${chatLatency}ms! AI responded: "${reply}"`);
    console.log('\x1b[32m\x1b[1m[SUCCESS] Groq API is 100% operational and ready for video clipping!\x1b[0m');
  } catch (err) {
    console.error(`\x1b[31m[FATAL]\x1b[0m Network error: ${err.message}`);
    process.exit(1);
  }
}

runTests();
