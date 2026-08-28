import { redirect } from "next/navigation";

type SearchParamValue = string | string[] | undefined;

interface LibraryRedirectProps {
  searchParams: Promise<{
    q?: SearchParamValue;
    sort?: SearchParamValue;
    decade?: SearchParamValue;
    heard?: SearchParamValue;
  }>;
}

export default async function LibraryRedirect({ searchParams }: LibraryRedirectProps) {
  const incoming = await searchParams;
  const params = new URLSearchParams();

  for (const key of ["q", "sort", "decade", "heard"] as const) {
    const value = firstParam(incoming[key]);
    if (value) params.set(key, value);
  }

  const query = params.toString();
  redirect(query ? `/explore?${query}` : "/explore");
}

function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
