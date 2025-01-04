import { AllInsights } from './components/all-insights/all-insights';
import { auth, currentUser } from '@clerk/nextjs/server';

export default async function Index() {
  // const { userId } = await auth();

  return (
    <div>
      <AllInsights />
      {/* {userId} */}
    </div>
  );
}
