import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/verify-access.middleware';
import { Client } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const insightsDatabaseId = 'caae7cadc59c43fe920dd5ce4048dade';

const router = Router();

router.get('/', verifyAccessToken, async (_, res) => {
  const response = await notion.databases.query({
    database_id: insightsDatabaseId,
  });
  // objects;
  console.log(
    res
      .status(200)
      .send(
        response.results.map((obj) =>
          ((obj as PageObjectResponse).properties.insight as any).title.map((title) => title.plain_text).join(', '),
        ),
      ),
  );
});

export default router;

/* "results": [
  {
      "object": "page",
      "id": "628880f3-6a22-403d-9e29-924f0b3966f9",
      "created_time": "2024-07-14T09:00:00.000Z",
      "last_edited_time": "2024-07-14T09:00:00.000Z",
      "created_by": {
          "object": "user",
          "id": "ec2b4462-c35c-49f5-bee8-6c3ff04f7a19"
      },
      "last_edited_by": {
          "object": "user",
          "id": "ec2b4462-c35c-49f5-bee8-6c3ff04f7a19"
      },
      "cover": null,
      "icon": null,
      "parent": {
          "type": "database_id",
          "database_id": "caae7cad-c59c-43fe-920d-d5ce4048dade"
      },
      "archived": false,
      "in_trash": false,
      "properties": {
          "insight": {
              "id": "title",
              "type": "title",
              "title": [
                  {
                      "type": "text",
                      "text": {
                          "content": "иногда добавление энергии это латание дыр, на которые уходит энергия",
                          "link": null
                      },
                      "annotations": {
                          "bold": false,
                          "italic": false,
                          "strikethrough": false,
                          "underline": false,
                          "code": false,
                          "color": "default"
                      },
                      "plain_text": "иногда добавление энергии это латание дыр, на которые уходит энергия",
                      "href": null
                  }
              ]
          }
      },
      "url": "https://www.notion.so/628880f36a22403d9e29924f0b3966f9",
      "public_url": null
}]
 */
