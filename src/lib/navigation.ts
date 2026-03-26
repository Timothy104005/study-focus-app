export function normalizeAppPath(nextPath: string | null | undefined) {
  const candidate = (nextPath ?? "/").trim();

  if (candidate.length === 0 || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/";
  }

  try {
    const parsed = new URL(candidate, "http://study-focus.local");

    if (parsed.origin !== "http://study-focus.local") {
      return "/";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}
