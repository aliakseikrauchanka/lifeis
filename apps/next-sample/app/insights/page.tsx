import { AllInsights } from "../components/all-insights";

export default async function Index() {
  // const { userId } = await auth();

  return (
    <div>
      <AllInsights />
      {/* {userId} */}
    </div>
  );
}