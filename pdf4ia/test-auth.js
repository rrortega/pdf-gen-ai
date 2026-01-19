// Simple test script for authentication
async function testHealth() {
  try {
    console.log("Testing health endpoint...");
    const response = await fetch("http://localhost:3030/api/health");
    const data = await response.json();
    console.log("Health response:", data);
    return true;
  } catch (error) {
    console.error("Health test failed:", error.message);
    return false;
  }
}

async function testAuth() {
  try {
    console.log("Testing registration...");
    const registerResponse = await fetch(
      "http://localhost:3030/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          name: "Test User",
        }),
      },
    );

    const registerData = await registerResponse.json();
    console.log("Register response:", registerData);

    if (registerData.success) {
      console.log("Registration successful!");
      console.log("Testing /me endpoint...");

      // Test /me endpoint
      const meResponse = await fetch("http://localhost:3030/api/v1/auth/me");
      const meData = await meResponse.json();
      console.log("Me response:", meData);
    }
  } catch (error) {
    console.error("Auth test failed:", error.message);
  }
}

async function runTests() {
  const healthOk = await testHealth();
  if (healthOk) {
    await testAuth();
  } else {
    console.log("Skipping auth test due to health check failure");
  }
}

runTests().catch(console.error);
