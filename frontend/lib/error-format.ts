export function toFriendlyError(input: string): { title: string; message: string } {
  const text = input.trim();
  const lower = text.toLowerCase();

  if (
    lower.includes("no valid authorization keys or user signing keys available") ||
    lower.includes("recovery method not supported")
  ) {
    return {
      title: "Wallet needs recovery",
      message:
        "Your Privy embedded wallet keys are not usable in this session. Log out and back in. If it persists, reset the test user wallet in Privy dashboard and re-login."
    };
  }

  if (lower.includes("insufficient gas for intrinsic cost") || lower.includes("gas_limit 0")) {
    return {
      title: "Transaction gas setup failed",
      message:
        "The wallet rejected transaction gas parameters. Refresh and try again. If it persists, switch account and retry."
    };
  }

  if (text.includes("401") || lower.includes("unauthorized")) {
    return {
      title: "Authentication required",
      message:
        "Your session token or dev auth header was rejected. Re-login with Privy or check backend auth mode and headers."
    };
  }

  if (lower.includes("cors") || lower.includes("access control")) {
    return {
      title: "Connection blocked by CORS",
      message: "Backend must allow requests from your frontend origin (localhost:3000)."
    };
  }

  if (lower.includes("failed to fetch") || lower.includes("network")) {
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
