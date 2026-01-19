// Simple debug script
console.log("=== PDFGenIA Debug Info ===");
console.log("Current working directory:", process.cwd());
console.log("Node version:", process.version);
console.log("Environment variables:");
console.log(
  "- NEXT_PUBLIC_APPWRITE_ENDPOINT:",
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
);
console.log(
  "- NEXT_PUBLIC_APPWRITE_PROJECT_ID:",
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
);
console.log(
  "- NEXT_PUBLIC_APPWRITE_DATABASE_ID:",
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
);
console.log(
  "- APPWRITE_API_KEY:",
  process.env.APPWRITE_API_KEY
    ? "Set (length: " + process.env.APPWRITE_API_KEY.length + ")"
    : "Not set",
);
console.log("- PDF_GENERATION_MODE:", process.env.PDF_GENERATION_MODE);
console.log("");

// Test basic connectivity
const testConnection = async () => {
  try {
    console.log("Testing connection to Appwrite...");
    // This will fail if the endpoint is wrong
    const response = await fetch(
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT + "/health",
      {
        method: "GET",
      },
    );
    console.log("Appwrite health check status:", response.status);
  } catch (error) {
    console.log("Connection test failed:", error.message);
    console.log(
      "This might be normal if the endpoint doesn't have a /health route",
    );
  }
};

testConnection();
