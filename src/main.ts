import { Notice, Plugin } from 'obsidian';
import { parseQuery, executeQuery } from './functions';

export default class QJSON extends Plugin {

	async onload() {
		const statusBarItemEl = this.addStatusBarItem();
		let qjCount;

		function updateStatusBarCounter() {
			qjCount = document.querySelectorAll('.cdQjson').length;
			statusBarItemEl.setText('QJSON: ' + qjCount);
		}

		this.registerEvent(this.app.workspace.on('file-open', () => {
			updateStatusBarCounter();
		}));

		this.registerMarkdownCodeBlockProcessor("qjson", async (source, el) => {
			if (!source.includes('#qj-id:')) {
				new Notice('No ID found');
				el.createEl('pre', { text: 'No ID found' });
				return;
			}
			let id;
			id = source.match(/#qj-id: (\d+)/);
			if (id) id = id[1];
			// check if id is a number
			if (isNaN(parseInt(id))) {
				new Notice('ID must be a number');
				el.createEl('pre', { text: 'ID must be a number' });
				return;
			}

			let query;

			if (source.includes('#qj-query:')) {
				query = source.match(/#qj-query: (.+)/);
				if (query) {
					query = query[1];
				} else {
					new Notice('No query found');
					el.createEl('pre', { text: 'No query found' });
					return;
				}
				query = parseQuery(query);
			}


			let format;

			if (source.includes('#qj-format:')) {
				format = source.match(/#qj-format: (.+)/);
				if (format) {
					format = format[1];
				} else {
					new Notice('No format found');
					el.createEl('pre', { text: 'No format found' });
					return;
				}
			}

			let desc;

			if (!source.includes('#qj-hide-id')) {
				try {
					desc = source.match(/#qj-desc: (.+)/);
					if (desc) desc = desc[1];
				} catch (e) {
					desc = "»»» QJSON «««";
				}
				el.createEl('h3', { text: desc!, cls: 'centerQJtext' });
				el.createEl('h4', { text: "ID: " + id, cls: 'centerQJtext' });
			}

			let showJson = 'notHere';

			if (source.includes('#qj-show-json')) {
				showJson = '';
			}

			if (source.includes('#qj-file:')) {
				const file = source.match(/#qj-file: (.+)/);
				if (file) {
					source = await this.app.vault.adapter.read(file[1]);
				} else {
					new Notice('No file found');
					el.createEl('pre', { text: 'No file found' });
					return;
				}
			}

			const json = JSON.parse(source);

			if (query) {
				const result = executeQuery(json, query);

				if (format && query[query.length - 1].type === "field") {
					if (format === "list") {
						const ul = el.createEl('ul');
						if (typeof result === 'string') {
							ul.createEl('li', { text: result });
						} else {
							for (let i = 0; i < result.length; i++) {
								ul.createEl('li', { text: JSON.stringify(result[i], null, 2) });
							}
						}
					} else if (format === "table") {
						const table = el.createEl('table');
						const tbody = table.createEl('tbody');
						if (typeof result === 'object') {
							for (const key in result) {
								const tr = tbody.createEl('tr');
								tr.createEl('th', { text: key });
								tr.createEl('td', { text: JSON.stringify(result[key], null, 2) });
							}
						} else {
							const tr = tbody.createEl('tr');
							tr.createEl('td', { text: result });
						}
					} else if (format === "img") {
						if (typeof result === 'string') {
							el.createEl('img', { attr: { src: result } });
						} else {
							for (let i = 0; i < result.length; i++) {
								el.createEl('img', { attr: { src: result[i], width: 100, height: 100 } });
							}
						}
					}
					return;
				}

				el.createEl('pre', { text: JSON.stringify(result, null, 2), cls: 'QJSON-' + id + ' cdQjson ' + showJson });
			} else {
				el.createEl('pre', { text: JSON.stringify(json, null, 2), cls: 'QJSON-' + id + ' cdQjson ' + showJson });
			}

			updateStatusBarCounter();
		});

		this.registerEvent(this.app.workspace.on('editor-change', async (editor) => {
			const cursor = editor.getCursor();
			const line = editor.getLine(cursor.line);
			const lastChar = line[line.length - 1];

			const match = line.match(/@(.+)>(.+)|@(.+)>/);
			if (!match) return;

			if (lastChar !== ';' && lastChar !== '.' && lastChar !== '>' && lastChar !== ']') return;

			const id = match[1] || match[3];
			let path = "";

			if (match[2] !== undefined) {
				path = match[2].slice(0, -1).replace(/>/, '')
			}

			let json;

			if (!isNaN(parseInt(id)) && !id.includes('.json')) {
				const el = document.querySelector('.QJSON-' + id) as HTMLElement | null;
				if (!el) return;
				json = JSON.parse(el.textContent || '');
			} else {
				json = JSON.parse(await this.app.vault.adapter.read(id));
			}

			path = path.replace(/\*/g, '').replace(/\[\]/g, '');
			let value = getJSONPath(json, path);

			if (lastChar !== ';') {
				if (value !== undefined) {
					const notice = document.querySelector('.notice');
					if (notice) notice.remove();

					const keys = Object.keys(value);
					const keysAreNumbers = keys.every(key => !isNaN(parseInt(key)));

					if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
						new Notice(value.toString());
					} else if (keysAreNumbers) {
						new Notice('Total Keys: ' + (keys.length - 1));
					} else {
						new Notice('Total Keys: ' + keys.length + '\n' + '____________' + '\n' + keys.join('\n'));
					}
				} 
			} else {
				if (line.includes('[*]')) {
					const temp_data = [];
					const arrayMatch = line.match(/(.+)\[\*\](?:\.(\w+))?/);
					if (arrayMatch) {
						const arrayKey = arrayMatch[1].slice(arrayMatch[1].indexOf('>') + 1);
						const property = arrayMatch[2];
						const arrayElements = getJSONPath(json, arrayKey);
						for (let i = 0; i < arrayElements.length; i++) {
							if (property) {
								temp_data.push(arrayElements[i][property]);
							} else {
								temp_data.push(arrayElements[i]);
							}
						}
					}
					value = temp_data;
				}
				const atIndex = line.indexOf('@');
				const replaceEnd = { line: cursor.line, ch: line.length }; // Replace to end of line
				const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
				editor.replaceRange(stringValue, { line: cursor.line, ch: atIndex }, replaceEnd);
			}
		}));

		// this.registerMarkdownPostProcessor( async (element, context) => {
		//   const codeblocks = element.findAll("code");

		//   for (let codeblock of codeblocks) {
		//     if (codeblock.classList.length >= 1) return;

		//     const text = codeblock.innerText;
		//     const regex = /@(.+)\.json>(.+);/;
		//     const match = text.match(regex);

		//     if (match) {
		//       let result;

		//       try {
		//         let file = await this.app.vault.adapter.read(match[1] + ".json");
		//         file = JSON.parse(file);
		//         result = getJSONPath(file, match[2]);
		//       } catch (e) {
		//         console.error(e);
		//         new Notice("Error! Something went wrong!");
		//         result = "Error!";
		//       }

		//       let stringResult;
		//       let tagName;

		//       if (typeof result === "string" || typeof result === "number" || typeof result === "boolean") {
		//         stringResult = result;
		//         tagName = "span";
		//       } else {
		//         stringResult = JSON.stringify(result, null, 2);
		//         tagName = "pre";
		//       }

		//       const resultEl = codeblock.createEl(tagName, {text: stringResult});
		//       codeblock.replaceWith(resultEl);
		//     }
		//   }
		// });
	}

}

function getJSONPath(json: Object, path: string) {
	if (path === '') return json;
	return path.split('.').reduce((acc, key) => acc[key], json);
}
