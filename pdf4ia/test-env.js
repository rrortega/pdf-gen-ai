// Test environment variables
async function testEnv() {
  try {
    console.log("Testing environment variables endpoint...");
    const response = await fetch("http://localhost:3030/api/env");
    const data = await response.json();
    console.log("Environment variables loaded:");
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to fetch env data:", error.message);
  }
}

testEnv();
