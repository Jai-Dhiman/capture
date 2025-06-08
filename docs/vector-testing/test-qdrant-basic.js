// Basic Qdrant Test Script
// Run this to verify your Qdrant setup is working

const QDRANT_URL = 'http://localhost:6333';
const COLLECTION_NAME = 'posts';

async function testQdrantBasics() {
  console.log('🧪 Testing Qdrant Basic Functionality...\n');
  
  try {
    // 1. Test connection
    console.log('1. Testing connection...');
    const healthResponse = await fetch(`${QDRANT_URL}/`);
    if (!healthResponse.ok) {
      throw new Error(`Qdrant not accessible: ${healthResponse.statusText}`);
    }
    console.log('✅ Qdrant connection successful\n');
    
    // 2. Check/Create collection
    console.log('2. Checking collection...');
    const collectionResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
    
    if (collectionResponse.status === 404) {
      console.log('Collection not found, creating...');
      const createResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vectors: {
            size: 768,
            distance: 'Cosine'
          }
        })
      });
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create collection: ${createResponse.statusText}`);
      }
      console.log('✅ Collection created successfully');
    } else if (collectionResponse.ok) {
      console.log('✅ Collection already exists');
    } else {
      throw new Error(`Collection check failed: ${collectionResponse.statusText}`);
    }
    
    // 3. Test vector operations
    console.log('\n3. Testing vector operations...');
    const testVector = Array.from({length: 768}, () => Math.random() - 0.5);
    const testId = Date.now(); // Use timestamp as ID
    
    // Upsert
    const upsertResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [{
          id: testId,
          vector: testVector,
          payload: {
            original_id: `test-post-${testId}`,
            content: 'This is a test post about machine learning and AI',
            test: true
          }
        }]
      })
    });
    
    if (!upsertResponse.ok) {
      const errorText = await upsertResponse.text();
      throw new Error(`Upsert failed: ${upsertResponse.statusText} - ${errorText}`);
    }
    console.log('✅ Vector upserted successfully');
    
    // Search
    const searchResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector: testVector,
        limit: 5,
        with_payload: true
      })
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.statusText}`);
    }
    
    const searchResult = await searchResponse.json();
    console.log('✅ Vector search successful');
    console.log(`Found ${searchResult.result.length} results`);
    
    if (searchResult.result.length > 0) {
      const topResult = searchResult.result[0];
      console.log(`Top result: ID=${topResult.id}, Score=${topResult.score}, Content="${topResult.payload?.content}"`);
    }
    
    // Delete
    const deleteResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [testId]
      })
    });
    
    if (!deleteResponse.ok) {
      throw new Error(`Delete failed: ${deleteResponse.statusText}`);
    }
    console.log('✅ Vector deleted successfully');
    
    console.log('\n🎉 All Qdrant tests passed!');
    console.log('\nNext steps:');
    console.log('- Start your development server');
    console.log('- Create some posts to test the full pipeline');
    console.log('- Check the Qdrant dashboard: http://localhost:6333/dashboard');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure Qdrant is running: docker ps');
    console.log('2. Start Qdrant: docker run -d --name qdrant -p 6333:6333 qdrant/qdrant');
    console.log('3. Check logs: docker logs qdrant');
  }
}

// Run the test
testQdrantBasics(); 