// Quick test to check if server is accessible
async function quickTest() {
  try {
    console.log("Testing basic connectivity...");

    // Test 1: Health endpoint
    const healthResponse = await fetch("http://localhost:3001/api/health");
    if (healthResponse.ok) {
      console.log("✅ Health endpoint works");
    } else {
      console.log("❌ Health endpoint failed:", healthResponse.status);
    }

    // Test 2: Env endpoint
    const envResponse = await fetch("http://localhost:3001/api/env");
    if (envResponse.ok) {
      const envData = await envResponse.json();
      console.log("✅ Env endpoint works");
      console.log("Environment variables status:");
      console.log("- APPWRITE_API_KEY:", envData.env.APPWRITE_API_KEY);
      console.log(
        "- NEXT_PUBLIC_APPWRITE_ENDPOINT:",
        envData.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
      );
    } else {
      console.log("❌ Env endpoint failed:", envResponse.status);
    }
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    console.log("Possible issues:");
    console.log("1. Server not running on port 3001");
    console.log("2. CORS issues");
    console.log("3. Network connectivity problems");
  }
}

quickTest();
