import LibrarySection from "@/components/LibrarySection";

export default async function HandbookPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  return <LibrarySection kind="handbook" searchParams={await searchParams} />;
}
