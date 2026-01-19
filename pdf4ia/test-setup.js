// Test script to setup Appwrite database
async function setupDatabase() {
  try {
    console.log("🚀 Setting up database...");
    const response = await fetch("http://localhost:3030/api/v1/setup", {
      method: "POST",
    });

    const result = await response.json();
    console.log("✅ Setup result:", result);

    if (result.success) {
      console.log("🎉 Database setup completed successfully!");
      console.log(
        "📋 Check database status at: http://localhost:3030/api/db-status",
      );
    } else {
      console.log("❌ Setup failed:", result.error);
    }
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
    console.log("💡 Make sure the server is running on port 3030");
  }
}

// Test authentication
async function testAuth() {
  try {
    // Register a test user
    console.log("🔐 Testing registration...");
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

    const registerResult = await registerResponse.json();
    console.log("✅ Register result:", registerResult);

    if (registerResult.success) {
      // Test login
      console.log("🔑 Testing login...");
      const loginResponse = await fetch("http://localhost:3030/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      const loginResult = await loginResponse.json();
      console.log("✅ Login result:", loginResult);

      // Get session cookie from response
      const sessionCookie = loginResponse.headers.get('set-cookie');
      console.log("🍪 Session cookie set:", !!sessionCookie);
    }

  } catch (error) {
    console.error("❌ Auth test failed:", error.message);
    console.log("💡 Make sure the server is running on port 3030");
  }
}
}

// Run tests
console.log("Testing PDF4IA setup...");
setupDatabase()
  .then(() => {
    console.log("Database setup completed");
    return testAuth();
  })
  .then(() => {
    console.log("All tests completed");
  })
  .catch(console.error);
