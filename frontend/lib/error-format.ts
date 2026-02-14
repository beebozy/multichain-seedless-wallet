export function toFriendlyError(input: string): { title: string; message: string } {
  const text = input.trim();

  if (text.includes("401") || text.toLowerCase().includes("unauthorized")) {
    return {
      title: "Authentication required",
      message:
        "Your session token or dev auth header was rejected. Re-login with Privy or check backend auth mode and headers."
    };
  }

  if (text.toLowerCase().includes("cors") || text.toLowerCase().includes("access control")) {
    return {
      title: "Connection blocked by CORS",
      message: "Backend must allow requests from your frontend origin (localhost:3000)."
    };
  }

  if (text.toLowerCase().includes("failed to fetch") || text.toLowerCase().includes("network")) {
    return {
      title: "Backend unreachable",
      message: "Check that backend is running and NEXT_PUBLIC_BACKEND_URL points to the right host and port."
    };
  }

  return {
    title: "Request failed",
    message: text.length > 260 ? `${text.slice(0, 257)}...` : text
  };
}
