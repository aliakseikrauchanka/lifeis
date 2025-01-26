import { getAuth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { NextRequest, NextResponse } from 'next/server';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

const notion = new Client({ auth: process.env.NEXT_NOTION_API_KEY });
const insightsDatabaseId = 'caae7cadc59c43fe920dd5ce4048dade';

export const GET = async (req: NextRequest, res: NextResponse) => {
  // const { userId } = getAuth(req);

  // if (!userId) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  // const response = await notion.databases.query({
  //   database_id: insightsDatabaseId,
  // });

  // const insights = response.results.map((obj) =>
  //   ((obj as PageObjectResponse).properties.insight as any).title.map((title: any) => title.plain_text).join(', '),
  // );

  return NextResponse.json([], { status: 200 });
};
