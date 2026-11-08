import LibrarySection from "@/components/LibrarySection";

export default async function PoliciesPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  return <LibrarySection kind="policy" searchParams={await searchParams} />;
}
