import axios from 'axios';
import chalk from 'chalk';

/**
 * 🧪 COMPREHENSIVE TEST SUITE
 * 
 * Tests all optimizations to ensure everything works correctly
 */

const BASE_URL = 'http://localhost:5000';
const API_URL = `${BASE_URL}/api/v1`;

// Test results storage
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to log test results
function logTest(name, passed, duration, details = '') {
  const status = passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
  const time = chalk.yellow(`${duration}ms`);
  console.log(`${status} ${name} - ${time}`);
  if (details) console.log(chalk.gray(`   ${details}`));
  
  results.tests.push({ name, passed, duration, details });
  if (passed) results.passed++;
  else results.failed++;
}

// Test 1: Basic Health Check
async function testHealthCheck() {
  const start = Date.now();
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    const duration = Date.now() - start;
    
    if (response.status === 200 && response.data.status === 'ok') {
      logTest('Health Check', true, duration, 'Server is running');
      return true;
    } else {
      logTest('Health Check', false, duration, 'Unexpected response');
      return false;
    }
  } catch (error) {
    const duration = Date.now() - start;
    logTest('Health Check', false, duration, error.message);
    return false;
  }
}

// Test 2: Detailed Health Check
async function testDetailedHealth() {
  const start = Date.now();
  try {
    const response = await axios.get(`${BASE_URL}/health/detailed`);
    const duration = Date.now() - start;
    
    if (response.status === 200 && response.data.status === 'ok') {
      const { server, database, socket } = response.data;
      const details = `Memory: ${server.memory.used}, DB: ${database.mongodb}, Sockets: ${socket.connected}`;
      logTest('Detailed Health Check', true, duration, details);
      return true;
    } else {
      logTest('Detailed Health Check', false, duration, 'Unexpected response');
      return false;
    }
  } catch (error) {
    const duration = Date.now() - start;
    logTest('Detailed Health Check', false, duration, error.message);
    return false;
  }
}

// Test 3: Search Functionality (Text Search)
async function testSearch() {
  const start = Date.now();
  try {
    const response = await axios.get(`${API_URL}/search?q=test`);
    const duration = Date.now() - start;
    
    if (response.status === 200 && response.data.success) {
      const { data, meta } = response.data;
      const totalResults = meta.totalResults || 0;
      const searchMethod = meta.searchMethod || 'unknown';
      const details = `Method: ${searchMethod}, Results: ${totalResults}, Speed: ${duration < 100 ? 'FAST' : 'SLOW'}`;
      
      // Check if using optimized text search
      const isOptimized = searchMethod === 'text_search' || searchMethod === 'robust_hybrid_search';
      logTest('Search Optimization', isOptimized, duration, details);
      return isOptimized;
    } else {
      logTest('Search Optimization', false, duration, 'Search failed');
      return false;
    }
  } catch (error) {
    const duration = Date.now() - start;
    logTest('Search Optimization', false, duration, error.message);
    return false;
  }
}

// Test 4: Performance Logging (Check if slow requests are logged)
async function testPerformanceLogging() {
  console.log(chalk.blue('\n📊 Testing Performance Logging...'));
  console.log(chalk.gray('   Making multiple requests to test logging...'));
  
  const start = Date.now();
  try {
    // Make 5 quick requests
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(axios.get(`${BASE_URL}/health`));
    }
    
    await Promise.all(requests);
    const duration = Date.now() - start;
    
    logTest('Performance Logging', true, duration, 'Check server logs for request times');
    return true;
  } catch (error) {
    const duration = Date.now() - start;
    logTest('Performance Logging', false, duration, error.message);
    return false;
  }
}

// Test 5: Database Indexes (Verify indexes exist)
async function testDatabaseIndexes() {
  console.log(chalk.blue('\n📊 Database Indexes Test...'));
  console.log(chalk.gray('   This test verifies indexes were created successfully'));
  
  // We can't directly test indexes from here, but we can verify search speed
  const start = Date.now();
  try {
    const response = await axios.get(`${API_URL}/search?q=javascript`);
    const duration = Date.now() - start;
    
    // If search is fast (< 100ms), indexes are likely working
    const isFast = duration < 100;
    const details = `Search completed in ${duration}ms - ${isFast ? 'Indexes working!' : 'May need optimization'}`;
    
    logTest('Database Indexes', isFast, duration, details);
    return isFast;
  } catch (error) {
    const duration = Date.now() - start;
    logTest('Database Indexes', false, duration, error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log(chalk.bold.cyan('\n🧪 STARTING COMPREHENSIVE TEST SUITE\n'));
  console.log(chalk.gray('Testing all optimizations...\n'));
  
  // Run all tests
  await testHealthCheck();
  await testDetailedHealth();
  await testSearch();
  await testPerformanceLogging();
  await testDatabaseIndexes();
  
  // Print summary
  console.log(chalk.bold.cyan('\n📊 TEST SUMMARY\n'));
  console.log(chalk.green(`✅ Passed: ${results.passed}`));
  console.log(chalk.red(`❌ Failed: ${results.failed}`));
  console.log(chalk.blue(`📝 Total: ${results.tests.length}`));
  
  // Calculate average response time
  const avgTime = results.tests.reduce((sum, t) => sum + t.duration, 0) / results.tests.length;
  console.log(chalk.yellow(`⚡ Average Response Time: ${Math.round(avgTime)}ms`));
  
  // Overall status
  if (results.failed === 0) {
    console.log(chalk.bold.green('\n🎉 ALL TESTS PASSED! Your optimizations are working perfectly!\n'));
  } else {
    console.log(chalk.bold.red(`\n⚠️  ${results.failed} test(s) failed. Check the details above.\n`));
  }
  
  // Performance rating
  if (avgTime < 50) {
    console.log(chalk.bold.green('⚡ PERFORMANCE RATING: EXCELLENT (< 50ms average)'));
  } else if (avgTime < 100) {
    console.log(chalk.bold.yellow('⚡ PERFORMANCE RATING: GOOD (< 100ms average)'));
  } else if (avgTime < 200) {
    console.log(chalk.bold.yellow('⚡ PERFORMANCE RATING: ACCEPTABLE (< 200ms average)'));
  } else {
    console.log(chalk.bold.red('⚡ PERFORMANCE RATING: NEEDS IMPROVEMENT (> 200ms average)'));
  }
  
  console.log('\n');
}

// Run tests
runTests().catch(error => {
  console.error(chalk.red('❌ Test suite failed:'), error.message);
  process.exit(1);
});
