// Check database status
async function checkDBStatus() {
  try {
    console.log("🔍 Checking database status...");

    // This will work if we access it through the Next.js server
    console.log("📋 To check database status, visit:");
    console.log("   http://localhost:3030/api/db-status");
    console.log("");
    console.log("📖 To view API documentation:");
    console.log("   http://localhost:3030/api/docs");
    console.log("");
    console.log("🏥 Health check:");
    console.log("   http://localhost:3030/api/health");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkDBStatus();
