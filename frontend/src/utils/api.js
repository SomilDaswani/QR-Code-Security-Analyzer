import axios from "axios";

export async function analyzeUrl(url) {
  console.log("[api] analyzeUrl →", url);
  const response = await axios.post("/api/analyze", { url });
  console.log("[api] Response:", response.data);
  return response.data;
}
