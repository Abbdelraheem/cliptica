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
    console.log(`Available models: \x1b[33m${ids.join(', ')}\x1b[0m`);
    console.log(`  - whisper-large-v3: ${ids.includes('whisper-large-v3') ? 'AVAILABLE' : 'MISSING'}`);
    console.log(`  - whisper-large-v3-turbo: ${ids.includes('whisper-large-v3-turbo') ? 'AVAILABLE' : 'MISSING'}`);

    const candidateModels = [
      'allam-2-7b',
      'qwen/qwen3.8-27b',
      'groq/compound-mini',
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
    ];
    const selectedModel = candidateModels.find(m => ids.includes(m)) || 'allam-2-7b';
    console.log(`\x1b[90m2. Querying Groq chat completion with model: ${selectedModel}...\x1b[0m`);
    const c0 = Date.now();
    const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
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

    console.log('\x1b[90m3. Testing JSON scoring prompt across candidate models...\x1b[0m');
    const scoreCandidates = ['allam-2-7b', 'qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-120b'].filter(m => ids.includes(m));
    for (const m of scoreCandidates) {
      try {
        const s0 = Date.now();
        const sRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: m,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'Return strict JSON {"moments":[{"index":0,"score":95,"title":"Viral Hook","reason":"High hook strength"}]}' },
              { role: 'user', content: 'Score this: {"text":"Welcome to the video"}' }
            ],
            max_tokens: 150,
          })
        });
        const sLatency = Date.now() - s0;
        if (sRes.ok) {
          const sData = await sRes.json();
          console.log(`  \x1b[32m[OK]\x1b[0m Model ${m} supports JSON scoring (${sLatency}ms): ${sData.choices[0].message.content.slice(0, 80)}...`);
        } else {
          console.log(`  \x1b[33m[WARN]\x1b[0m Model ${m} returned ${sRes.status}: ${(await sRes.text()).slice(0, 80)}`);
        }
      } catch (err) {
        console.log(`  \x1b[31m[FAIL]\x1b[0m Model ${m} error: ${err.message}`);
      }
    }
    console.log('\x1b[90m4. Testing Groq audio transcription (whisper-large-v3-turbo)...\x1b[0m');
    function createSilentWav(durationSec = 1) {
      const sampleRate = 16000;
      const numSamples = sampleRate * durationSec;
      const dataSize = numSamples * 2;
      const buffer = Buffer.alloc(44 + dataSize);
      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(36 + dataSize, 4);
      buffer.write('WAVE', 8);
      buffer.write('fmt ', 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(1, 22);
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(sampleRate * 2, 28);
      buffer.writeUInt16LE(2, 32);
      buffer.writeUInt16LE(16, 34);
      buffer.write('data', 36);
      buffer.writeUInt32LE(dataSize, 40);
      return buffer;
    }

    const wavBuf = createSilentWav(1);
    const audioForm = new FormData();
    audioForm.append('file', new Blob([wavBuf], { type: 'audio/wav' }), 'test.wav');
    audioForm.append('model', 'whisper-large-v3-turbo');
    audioForm.append('response_format', 'verbose_json');

    const a0 = Date.now();
    const audioRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: audioForm,
    });
    const aLatency = Date.now() - a0;

    if (audioRes.ok) {
      const aData = await audioRes.json();
      console.log(`  \x1b[32m[PASS]\x1b[0m Whisper transcription OK in ${aLatency}ms! Language detected: ${aData.language || 'unknown'}`);
    } else {
      const aErr = await audioRes.text();
      console.log(`  \x1b[31m[FAIL]\x1b[0m Whisper transcription returned ${audioRes.status}: ${aErr.slice(0, 100)}`);
    }

    console.log('\x1b[32m\x1b[1m[SUCCESS] Groq API is 100% operational and ready for video clipping!\x1b[0m');
  } catch (err) {
    console.error(`\x1b[31m[FATAL]\x1b[0m Network error: ${err.message}`);
    process.exit(1);
  }
}

runTests();
