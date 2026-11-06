import { Landing } from "@/features/landing/landing";
import { PublicFrame } from "@/features/shell/public-frame";
import { currentUserId } from "@/server/auth/current-user";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string; deleted?: string }>;
}) {
  const { connect, deleted } = await searchParams;
  const isSignedIn = (await currentUserId()) !== null;

  return (
    <PublicFrame isSignedIn={isSignedIn}>
      <Landing
        isSignedIn={isSignedIn}
        hasFailed={connect === "failed"}
        isDeleted={deleted === "1"}
      />
    </PublicFrame>
  );
}
