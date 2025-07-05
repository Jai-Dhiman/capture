#!/usr/bin/env node
/**
 * Test script for the recommendation system
 */

const BASE_URL = 'http://localhost:50330';

async function testHealthEndpoint() {
    console.log('\n=== Testing Health Endpoint ===');
    try {
        const response = await fetch(`${BASE_URL}/test/embedding-health`);
        const data = await response.json();
        console.log('Health Status:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Health test failed:', error.message);
        return null;
    }
}

async function testQdrantInfo() {
    console.log('\n=== Testing Qdrant Info ===');
    try {
        const response = await fetch(`${BASE_URL}/test/qdrant-info`);
        const data = await response.json();
        console.log('Qdrant Info:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Qdrant info test failed:', error.message);
        return null;
    }
}

async function testWasmSimilarity() {
    console.log('\n=== Testing WASM Similarity ===');
    
    // Create two random 1024-dimensional vectors
    const vector1 = Array.from({ length: 1024 }, () => Math.random());
    const vector2 = Array.from({ length: 1024 }, () => Math.random());
    
    try {
        const response = await fetch(`${BASE_URL}/test/wasm-similarity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                vector1,
                vector2
            })
        });
        
        const data = await response.json();
        console.log('WASM Similarity Result:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('WASM similarity test failed:', error.message);
        return null;
    }
}

async function testEmbeddingGeneration() {
    console.log('\n=== Testing Embedding Generation ===');
    
    try {
        const response = await fetch(`${BASE_URL}/test/test-embedding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: 'This is a test post about artificial intelligence and machine learning',
                provider: 'voyage'
            })
        });
        
        const data = await response.json();
        console.log('Embedding Generation Result:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Embedding generation test failed:', error.message);
        return null;
    }
}

async function testPostEmbedding() {
    console.log('\n=== Testing Post Embedding Flow ===');
    
    try {
        const response = await fetch(`${BASE_URL}/test/test-post-embedding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                postId: 'test-post-' + Date.now(),
                content: 'This is a test post about technology and innovation',
                hashtags: ['tech', 'innovation', 'ai'],
                userId: 'test-user-123'
            })
        });
        
        const data = await response.json();
        console.log('Post Embedding Result:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Post embedding test failed:', error.message);
        return null;
    }
}

async function testBatchSearch() {
    console.log('\n=== Testing Batch Vector Search ===');
    
    // Create test vectors
    const queryVector = Array.from({ length: 1024 }, () => Math.random());
    const candidateVectors = [];
    
    // Create 10 candidate vectors (10 * 1024 = 10240 elements)
    for (let i = 0; i < 10; i++) {
        candidateVectors.push(...Array.from({ length: 1024 }, () => Math.random()));
    }
    
    try {
        const response = await fetch(`${BASE_URL}/test/test-batch-search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                queryVector,
                candidateVectors,
                k: 5
            })
        });
        
        const data = await response.json();
        console.log('Batch Search Result:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Batch search test failed:', error.message);
        return null;
    }
}

async function testDiscoveryScoring() {
    console.log('\n=== Testing Discovery Scoring ===');
    
    // Create test data
    const userPreferences = Array.from({ length: 1024 }, () => Math.random());
    const contentVectors = [];
    
    // Create 5 content vectors
    for (let i = 0; i < 5; i++) {
        contentVectors.push(...Array.from({ length: 1024 }, () => Math.random()));
    }
    
    const recencyScores = [0.9, 0.8, 0.7, 0.6, 0.5];
    const popularityScores = [0.7, 0.8, 0.9, 0.6, 0.5];
    
    try {
        const response = await fetch(`${BASE_URL}/test/test-discovery-scoring`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userPreferences,
                contentVectors,
                recencyScores,
                popularityScores
            })
        });
        
        const data = await response.json();
        console.log('Discovery Scoring Result:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Discovery scoring test failed:', error.message);
        return null;
    }
}

async function runAllTests() {
    console.log('🚀 Starting Recommendation System Test Suite\n');
    
    const results = {};
    
    // Test basic health and connectivity
    results.health = await testHealthEndpoint();
    results.qdrantInfo = await testQdrantInfo();
    
    // Test WASM functionality
    results.wasmSimilarity = await testWasmSimilarity();
    results.batchSearch = await testBatchSearch();
    results.discoveryScoring = await testDiscoveryScoring();
    
    // Test embedding generation
    results.embeddingGeneration = await testEmbeddingGeneration();
    results.postEmbedding = await testPostEmbedding();
    
    // Summary
    console.log('\n=== Test Summary ===');
    const testNames = Object.keys(results);
    const passedTests = testNames.filter(name => results[name] && results[name].success !== false);
    const failedTests = testNames.filter(name => !results[name] || results[name].success === false);
    
    console.log(`✅ Passed: ${passedTests.length}/${testNames.length}`);
    console.log(`❌ Failed: ${failedTests.length}/${testNames.length}`);
    
    if (failedTests.length > 0) {
        console.log('\nFailed tests:', failedTests.join(', '));
    }
    
    return results;
}

// Run the tests
runAllTests().catch(console.error);