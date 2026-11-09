import DashboardHeader from "@/components/DashboardHeader";
import OrgChart from "@/components/OrgChart";
import SignedInBar from "@/components/SignedInBar";
import { listPeople } from "@/lib/directory";
import { getMyProfile } from "@/lib/profile";

export default async function OrgChartPage() {
  const [profile, people] = await Promise.all([getMyProfile(), listPeople()]);

  return (
    <div className="flex min-h-screen flex-col">
      <SignedInBar profile={profile} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <DashboardHeader profile={profile} active="org" />
        <p className="-mt-2 text-sm text-muted">
          Who reports to whom. People report to their department manager unless an admin picks someone else on Manage people.
          {profile?.role?.is_admin && <> <a href="/admin/people" className="text-accent underline">Edit reporting lines</a></>}
        </p>

        <OrgChart people={people} myId={profile?.id} />
      </main>
    </div>
  );
}
