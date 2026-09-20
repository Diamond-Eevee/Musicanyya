import { parseXml } from '@rgrove/parse-xml';

const doc = parseXml('<root><a/></root>', {
  preserveDocumentNode: true,
  preserveComments: true,
  ignoreUndefinedEntities: false,
});
console.log(JSON.stringify(doc, null, 2));
