const http = require('http');

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          };
          resolve(response);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testAuthentication() {
  console.log('Testing Authentication System...\n');

  const baseOptions = {
    hostname: 'localhost',
    port: 3001,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  try {
    // Test 1: Register a new user
    console.log('1. Testing user registration...');
    const registerResponse = await makeRequest({
      ...baseOptions,
      path: '/api/auth/register',
      method: 'POST'
    }, {
      screenName: 'testuser123',
      password: 'password123',
      email: 'test@example.com'
    });

    console.log(`Status: ${registerResponse.statusCode}`);
    console.log(`Response:`, registerResponse.body);
    
    if (registerResponse.statusCode !== 201) {
      console.log('❌ Registration failed');
      return;
    }
    
    const authToken = registerResponse.body.data.token;
    console.log('✅ Registration successful\n');

    // Test 2: Login with the same user
    console.log('2. Testing user login...');
    const loginResponse = await makeRequest({
      ...baseOptions,
      path: '/api/auth/login',
      method: 'POST'
    }, {
      screenName: 'testuser123',
      password: 'password123'
    });

    console.log(`Status: ${loginResponse.statusCode}`);
    console.log(`Response:`, loginResponse.body);
    
    if (loginResponse.statusCode !== 200) {
      console.log('❌ Login failed');
      return;
    }
    console.log('✅ Login successful\n');

    // Test 3: Access protected route
    console.log('3. Testing protected route access...');
    const meResponse = await makeRequest({
      ...baseOptions,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        ...baseOptions.headers,
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log(`Status: ${meResponse.statusCode}`);
    console.log(`Response:`, meResponse.body);
    
    if (meResponse.statusCode !== 200) {
      console.log('❌ Protected route access failed');
      return;
    }
    console.log('✅ Protected route access successful\n');

    // Test 4: Logout
    console.log('4. Testing logout...');
    const logoutResponse = await makeRequest({
      ...baseOptions,
      path: '/api/auth/logout',
      method: 'POST',
      headers: {
        ...baseOptions.headers,
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log(`Status: ${logoutResponse.statusCode}`);
    console.log(`Response:`, logoutResponse.body);
    
    if (logoutResponse.statusCode !== 200) {
      console.log('❌ Logout failed');
      return;
    }
    console.log('✅ Logout successful\n');

    console.log('🎉 All authentication tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Check if server is running first
const healthCheck = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/health',
  method: 'GET'
}, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Server is running, starting tests...\n');
    testAuthentication();
  } else {
    console.log('❌ Server health check failed');
  }
});

healthCheck.on('error', (error) => {
  console.log('❌ Server is not running. Please start the server with: npm run dev');
  console.log('Error:', error.message);
});

healthCheck.end();