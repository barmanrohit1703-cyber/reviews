import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Configuration from your script
const AUTH_URL = "https://login.etrusted.com/oauth/token";
const REVIEWS_URL = "https://api.etrusted.com/reviews";

const CREDENTIALS = {
  client_id: process.env.ETRUSTED_CLIENT_ID,
  client_secret: process.env.ETRUSTED_CLIENT_SECRET,
  grant_type: "client_credentials",
  audience: process.env.ETRUSTED_AUDIENCE,
};

let accessToken = null;

// Function to get a fresh token
async function getAccessToken() {
  try {
    const params = new URLSearchParams(CREDENTIALS);
    const response = await axios.post(AUTH_URL, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    accessToken = response.data.access_token;
    console.log("New Token Generated");
    return accessToken;
  } catch (error) {
    console.error("Auth Error:", error.response?.data || error.message);
    throw error;
  }
}

// API Endpoint to get filtered reviews
app.get("/", (req, res) => {
  // Log message in your Node terminal
  console.log("✅ Welcome! The Review API is ready to serve requests.");

  // Send professional response to the browser
  res.status(200).json({
    status: "online",
    message: "Welcome to the eTrusted Review Proxy API",
    endpoints: {
      reviews: "/api/reviews",
    },
  });
});

// get reviews
app.get("/api/reviews", async (req, res) => {
  const count = parseInt(req.query.count) || 500;
  const rating = req.query.rating || "5,4";
  const type = req.query.type || "PRODUCT_REVIEW";
  const status = req.query.status || "APPROVED";

  try {
    if (!accessToken) await getAccessToken();

    let apiResponse;
    const fetchReviews = () =>
      axios.get(REVIEWS_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          type,
          count,
          rating,
          status,
        },
      });

    try {
      apiResponse = await fetchReviews();
    } catch (err) {
      if (err.response?.status === 401) {
        await getAccessToken();
        apiResponse = await fetchReviews();
      } else {
        throw err;
      }
    }

    // Filter for 4 & 5 star reviews
    // Using .items based on your provided JSON structure
    const allReviews = apiResponse.data?.items || [];
    const filtered = allReviews.filter((r) => r.rating >= 4);

    // Standardized JSON Response
    res.json({
      status: "success",
      total_fetched: allReviews.length,
      total_filtered: filtered.length,
      data: filtered,
    });
  } catch (error) {
    console.error("Route Error:", error.message);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch reviews",
      details: error.message,
    });
  }
});

// Keep this so the app works on your computer
if (process.env.NODE_ENV !== "prod") {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// CRITICAL: Vercel needs this export to handle the request
export default app;
