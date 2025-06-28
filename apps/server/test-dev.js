#!/usr/bin/env node

/**
 * Development Testing Script for Phase 1 Recommendation System
 * 
 * Usage:
 *   node test-dev.js setup     # Setup Qdrant and verify connections
 *   node test-dev.js qdrant    # Test Qdrant operations
 *   node test-dev.js posts     # List posts in Qdrant
 *   node test-dev.js search    # Test vector search
 */

const QDRANT_URL = 'https://d1aec0ff-a8db-4d23-94b6-ced5657d9f31.us-west-1-0.aws.cloud.qdrant.io:6333';
const QDRANT_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.B7whW0h-ibjXXBFgwjNwzmDqeZLBy3QxdtYxPJCe3Nw';
const COLLECTION_NAME = 'posts';
const API_URL = process.env.API_URL || 'https://capture-api.jai-d.workers.dev';

async function setupQdrant() {
  console.log('🚀 Setting up Qdrant...');
  
  try {
    // Check if Qdrant is running
    const healthResponse = await fetch(QDRANT_URL);
    const health = await healthResponse.json();
    console.log('✅ Qdrant is running:', health.title);
    
          // Check if collection exists
      const collectionResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        headers: { 'api-key': QDRANT_API_KEY }
      });
    
    if (collectionResponse.status === 404) {
      console.log('📦 Creating collection...');
              const createResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'api-key': QDRANT_API_KEY },
        body: JSON.stringify({
          vectors: {
            size: 768,
            distance: 'Cosine'
          }
        })
      });
      
      if (createResponse.ok) {
        console.log('✅ Collection created successfully');
      } else {
        console.log('❌ Failed to create collection:', await createResponse.text());
      }
    } else if (collectionResponse.ok) {
      const collection = await collectionResponse.json();
      console.log('✅ Collection exists:', collection.result.config);
    } else {
      console.log('❌ Failed to check collection:', await collectionResponse.text());
    }
    
  } catch (error) {
    console.log('❌ Error setting up Qdrant:', error.message);
    console.log('💡 Make sure Qdrant is running: docker run -d --name qdrant -p 6333:6333 qdrant/qdrant');
  }
}

async function testQdrantOperations() {
  console.log('🧪 Testing Qdrant operations...');
  
  try {
    // Create a test vector
    const testVector = Array.from({length: 768}, () => Math.random() - 0.5);
    const testId = Math.floor(Math.random() * 1000000);
    
    console.log('📝 Inserting test vector...');
    const insertResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'api-key': QDRANT_API_KEY },
      body: JSON.stringify({
        points: [{
          id: testId,
          vector: testVector,
          payload: {
            original_id: `test:${testId}`,
            post_id: `test-post-${testId}`,
            text: 'This is a test vector for development',
            content_type: 'text',
            created_at: new Date().toISOString()
          }
        }]
      })
    });
    
    if (insertResponse.ok) {
      console.log('✅ Test vector inserted');
      
      // Search for similar vectors
      console.log('🔍 Searching for similar vectors...');
      const searchResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': QDRANT_API_KEY },
        body: JSON.stringify({
          vector: testVector,
          limit: 5,
          with_payload: true
        })
      });
      
      if (searchResponse.ok) {
        const searchResult = await searchResponse.json();
        console.log('✅ Search successful, found', searchResult.result.length, 'results');
        searchResult.result.forEach((point, i) => {
          console.log(`  ${i+1}. Score: ${point.score.toFixed(4)}, ID: ${point.payload?.original_id || point.id}`);
        });
      } else {
        console.log('❌ Search failed:', await searchResponse.text());
      }
      
    } else {
      console.log('❌ Failed to insert test vector:', await insertResponse.text());
    }
    
  } catch (error) {
    console.log('❌ Error testing Qdrant:', error.message);
  }
}

async function listPosts() {
  console.log('📋 Listing posts in Qdrant...');
  
  try {
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': QDRANT_API_KEY },
      body: JSON.stringify({
        limit: 20,
        with_payload: true
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Found ${result.result.points.length} points in collection`);
      
      result.result.points.forEach((point, i) => {
        const payload = point.payload || {};
        console.log(`  ${i+1}. ID: ${payload.original_id || point.id}`);
        console.log(`      Text: ${payload.text?.substring(0, 60)}...`);
        console.log(`      Type: ${payload.content_type || 'unknown'}`);
        console.log(`      Created: ${payload.created_at || 'unknown'}`);
        console.log('');
      });
    } else {
      console.log('❌ Failed to list posts:', await response.text());
    }
    
  } catch (error) {
    console.log('❌ Error listing posts:', error.message);
  }
}

async function testVectorSearch() {
  console.log('🔍 Testing vector search with sample query...');
  
  try {
    // Create a search vector for "artificial intelligence machine learning"
    const searchResponse = await fetch(`${API_URL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'artificial intelligence machine learning technology programming'
      })
    });
    
    if (!searchResponse.ok) {
      console.log('❌ Failed to generate search vector via API');
      return;
    }
    
    const { vector } = await searchResponse.json();
    console.log('✅ Generated search vector with dimension:', vector.length);
    
    // Search in Qdrant
    const qdrantResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': QDRANT_API_KEY },
      body: JSON.stringify({
        vector: vector,
        limit: 10,
        with_payload: true
      })
    });
    
    if (qdrantResponse.ok) {
      const result = await qdrantResponse.json();
      console.log(`🎯 Found ${result.result.length} similar posts:`);
      
      result.result.forEach((point, i) => {
        const payload = point.payload || {};
        console.log(`  ${i+1}. Score: ${point.score.toFixed(4)}`);
        console.log(`      Post: ${payload.original_id || point.id}`);
        console.log(`      Text: ${payload.text?.substring(0, 80)}...`);
        console.log('');
      });
    } else {
      console.log('❌ Vector search failed:', await qdrantResponse.text());
    }
    
  } catch (error) {
    console.log('❌ Error testing vector search:', error.message);
  }
}

async function main() {
  const command = process.argv[2];
  
  console.log('🔧 Phase 1 Recommendation System - Development Testing\n');
  
  switch (command) {
    case 'setup':
      await setupQdrant();
      break;
      
    case 'qdrant':
      await testQdrantOperations();
      break;
      
    case 'posts':
      await listPosts();
      break;
      
    case 'search':
      await testVectorSearch();
      break;
      
    default:
      console.log('Usage:');
      console.log('  node test-dev.js setup     # Setup Qdrant and verify connections');
      console.log('  node test-dev.js qdrant    # Test Qdrant operations');
      console.log('  node test-dev.js posts     # List posts in Qdrant');
      console.log('  node test-dev.js search    # Test vector search');
      console.log('');
      console.log('Make sure both Qdrant and your Workers dev server are running!');
      break;
  }
}

main().catch(console.error); 