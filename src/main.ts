import { App, Notice, Plugin } from 'obsidian';
import { parseQuery, executeQuery} from './functions';

export default class QJSON extends Plugin {

	async onload() {
		const statusBarItemEl = this.addStatusBarItem();
		let qjCount;
		qjCount = document.querySelectorAll('.cdQjson').length;
		statusBarItemEl.setText('QJSON: ' + qjCount);

		this.registerMarkdownCodeBlockProcessor("qjson", async (source, el, ctx) => {
			if (!source.includes('#qj-id:')) {
				new Notice('No ID found');
				el.createEl('pre', {text: 'No ID found'});
				return;
			}

			const id = source.match(/#qj-id: (\d+)/)[1];
			// check if id is a number
			if (isNaN(id)) {
				new Notice('ID must be a number');
				el.createEl('pre', {text: 'ID must be a number'});
				return;
			}

			let query;

			if (source.includes('#qj-query:')) {
				query = source.match(/#qj-query: (.+)/)[1];
				query = parseQuery(query);
			}

			let desc;

			if (!source.includes('#qj-hide-id')) {
			    try {
			        desc = source.match(/#qj-desc: (.+)/)[1];
			    } catch (e) {
			        desc = "»»» Query JSON «««";
			    }
			    el.createEl('h3', {text: desc, cls: 'centerQJtext'});
			    el.createEl('h4', {text: "ID: " + id, cls: 'centerQJtext'});
			}

			let showJson = 'notHere';

			if (source.includes('#qj-show-json')) {
				showJson = '';
			}

			if (source.includes('#qj-file:')) {
				const file = source.match(/#qj-file: (.+)/)[1];
				const response = await this.app.vault.adapter.read(file);
				source = response;
			}

			const json = JSON.parse(source);

			if (query) {
				const result = executeQuery(json, query);
				el.createEl('pre', {text: JSON.stringify(result, null, 2), cls: 'QJSON-'+id+' cdQjson '+showJson});
			} else {
				el.createEl('pre', {text: JSON.stringify(json, null, 2), cls: 'QJSON-'+id+' cdQjson '+showJson});
			}

			qjCount = document.querySelectorAll('.cdQjson').length;
			statusBarItemEl.setText('QJSON: ' + qjCount);
		});

		// this.registerEvent(this.app.workspace.on('editor-change', async (editor, info) => {
		//   const cursor = editor.getCursor();
		//   const line = editor.getLine(cursor.line);

		//   const lastChar = line[line.length - 1];

		//   const match = line.match(/@(.+)>(.+)|@(.+)>/);
		//   if (!match) return;

		//   if (lastChar !== ';' && lastChar !== '.' && lastChar !== '>') return;

		//   const id = match[1] || match[3];
		//   let path = "";
		  
		//   if (match[2] !== undefined) {
		//   	path = match[2].slice(0, -1).replace(/>/, '')
		//   }

		//   let json;

		//   if (!isNaN(parseInt(id)) && !id.includes('.json')) {
		//     const el = document.querySelector('.QJSON-' + id);
		// 	if (!el) return;
		//   	json = JSON.parse(el.innerText);
		//   } else {
		//   	json = JSON.parse(await this.app.vault.adapter.read(id));
		//   }

		//   const value = getJSONPath(json, path);

		//   if (lastChar !== ';') {
		//     if (value !== undefined) {
		// 	  	const notice = document.querySelector('.notice');
		// 	  	if (notice) notice.remove();
			  	
		//     	const keys = Object.keys(value);
		//     	const keysAreNumbers = keys.every(key => !isNaN(parseInt(key)));

		// 		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		// 			new Notice(value.toString());
		//     	} else if (keysAreNumbers) {
		//     		new Notice('Total Keys: ' + (keys.length- 1 ));
		//     	} else {
		//     		new Notice('Total Keys: ' + keys.length + '\n' + '____________' + '\n' + keys.join('\n'));
		//     	}
		//     } 
		//   } else {
		//     const atIndex = line.indexOf('@');
		//     const replaceEnd = { line: cursor.line, ch: line.length }; // Replace to end of line
		//     const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
		//     editor.replaceRange(stringValue, { line: cursor.line, ch: atIndex }, replaceEnd);
		//   }
		// }));

    this.registerMarkdownPostProcessor( async (element, context) => {
      const codeblocks = element.findAll("code");

      for (let codeblock of codeblocks) {
        if (codeblock.classList.length >= 1) return;

        const text = codeblock.innerText;
        const regex = /@(.+)\.json>(.+);/;
        const match = text.match(regex);

        if (match) {
          let result;

          try {
            let file = await this.app.vault.adapter.read(match[1] + ".json");
            file = JSON.parse(file);
            result = getJSONPath(file, match[2]);
          } catch (e) {
            console.error(e);
            new Notice("Error! Something went wrong!");
            result = "Error!";
          }

          let stringResult;
          let tagName;

          if (typeof result === "string" || typeof result === "number" || typeof result === "boolean") {
            stringResult = result;
            tagName = "span";
          } else {
            stringResult = JSON.stringify(result, null, 2);
            tagName = "pre";
          }

          const resultEl = codeblock.createEl(tagName, {text: stringResult});
          codeblock.replaceWith(resultEl);
        }
      }
    });
	}

}

function getJSONPath(json: Object, path: string) {
	if (path === '') return json;
	return path.split('.').reduce((acc, key) => acc[key], json);
}
