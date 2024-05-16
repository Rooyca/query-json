import { App, Notice, Plugin } from 'obsidian';

export default class QJSON extends Plugin {
  async onload() {
    this.registerMarkdownPostProcessor( async (element, context) => {
      const codeblocks = element.findAll("code");

      for (let codeblock of codeblocks) {
        const text = codeblock.innerText.trim();

		// @NAME.json=store.books.0;
        const regex = /@(.+)\.json=(.+);/;
		const match = text.match(regex);

        if (match) {
		  let result;

		  try {
		  	const file = await this.app.vault.adapter.read(match[1] + ".json");
		  	result = getJSONPath(file, match[2]);
		  } catch (e) {
		  	console.error(e);
		  	new Notice("Error! Something went wrong!");
		  	result = "Error!";
		  }

		  const stringResult = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

          const resultEl = codeblock.createSpan({
            text: stringResult,
          });
          codeblock.replaceWith(resultEl);
        }
      }
    });
  }
}

function getJSONPath(json, path) {
	return path.split('.').reduce((obj, key) => obj[key], JSON.parse(json));
}
