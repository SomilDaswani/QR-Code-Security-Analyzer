import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function analyzeUrl(url) {
  console.log("[api] analyzeUrl →", url);
  const response = await axios.post(`${BASE}/api/analyze`, { url });
  console.log("[api] Response:", response.data);
  return response.data;
}
