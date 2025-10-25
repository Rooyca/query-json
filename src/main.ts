import { Notice, Plugin } from 'obsidian';
import { parseQuery, executeQuery } from './functions';

export default class QJSON extends Plugin {

	async onload() {
		const statusBarItemEl = this.addStatusBarItem();
		let qjCount;

		function updateStatusBarCounter() {
			qjCount = document.querySelectorAll('.cdQjson').length;
			qjCount++;
			statusBarItemEl.setText(qjCount + ' qjson');
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
			id = source.match(/^#qj-id: (\d+)$/m);
			if (id) id = id[1];
			// check if id is a number
			if (isNaN(parseInt(id))) {
				new Notice('ID must be a number');
				el.createEl('pre', { text: 'ID must be a number' });
				return;
			}

			let query;

			if (source.includes('#qj-query:')) {
				query = source.match(/^#qj-query: ([^\n\r]+)$/m);
				if (query) {
					query = query[1];
				} else {
					new Notice('No query found');
					el.createEl('pre', { text: 'No query found' });
					return;
				}

				// Parsing properties
				let properties = app.metadataCache.getFileCache(this.app.workspace.getActiveFile());
				if (properties && properties.frontmatter) {
					for (const key in properties.frontmatter) {
						query = query.replace(new RegExp(`{this.${key}}`, 'g'), properties.frontmatter[key]);
					}
				}
				console.log(query);

				query = parseQuery(query);
			}


			let format;
			let selectedFields;

			if (source.includes('#qj-format:')) {
				format = source.match(/^#qj-format: ([^\[\n\r ]+)[\t\f ]*(?:\[((?:[^\]\n\r=:,\"]*:(?:[^\]\n\r=:,\"]+|"[^\"]+")(?::[^\]\n\r=,]+)?(?:=[^\]\n\r,]+)?(?:,[^\n\r\w]*)?)+)\])?$/m);
				if (format) {
					if (format[2]) {
						const formats = format[2].split(/(?<=[^\]\n\r=:,\"]*:(?:[^\]\n\r=:,\"]+|"[^\"]+")(?::[^\]\n\r=,]+)?(?:=[^\]\n\r,]+)?)[\t\f ]*,/);
						selectedFields = formats.map(f => {
							const fParts = f.match(/^([^\]\n\r=:,\"]*):(?:([^\]\n\r=:,\"]+)|"([^\"]+)")(?::([^\]\n\r=,]+))?(?:=([^\]\n\r,]+))?$/);
							const flags = fParts[1];
							const name = fParts[5] || null;
							const field = fParts[2] || null;
							const template = fParts[3] || null;
							const field2 = fParts[4] || null;
							return {
								header: flags.includes('h'),
								bold: flags.includes('b'),
								comma: flags.includes('c'),
								br: flags.includes('n'),
								link: flags.includes('l'),
								name: name,
								field: field,
								template: template,
								field2: field2
							};
						});
						let first = true;
						for (const sf of selectedFields) {
							if (first) {
									first = false;
							} else {
								if (sf.header) {
									new Notice('Field format "header" is not in first position');
									el.createEl('pre', { text: 'Field format "header" is not in first position' });
									return;
								}
							}
							if (!sf.field && !sf.template) {
								new Notice('Field format is missing field name');
								el.createEl('pre', { text: 'Field format is missing field name' });
								return;
							}
							if (sf.link && !sf.field2) {
								new Notice( 'Field format link is missing second field name');
								el.createEl('pre', { text: 'Field format link is missing second field name' });
								return;
							}
							if (sf.template && !sf.name) {
								new Notice( 'Field format with template must provide name');
								el.createEl('pre', { text: 'Field format with template must provide name' });
								return;
							}
						}
					}
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
					desc = source.match(/^#qj-desc: ([^\n\r]+)$/m);
					desc = desc[1] ?? "»»» QJSON «««";
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
				const file = source.match(/^#qj-file: ([^\n\r]+)$/m);
				if (file) {
					try {
						//console.log(this.app.workspace.getActiveFile().parent.path);
						// Code that might throw an error
						source = await this.app.vault.adapter.read(file[1]);
					} catch {
						const filePath = this.app.workspace.getActiveFile().parent.path + '/';
						source = await this.app.vault.adapter.read(filePath + file[1]);
					}
				} else {
					new Notice('No file given');
					el.createEl('pre', { text: 'No file given' });
					return;
				}
			} else {
				source = source.replace(/^#qj-[a-z]+(: )?.*$/gm, "");
			}
			
			const json = JSON.parse(source);

			let result = json;
			let fieldResult;

			if (query) {
				result = executeQuery(json, query);
				fieldResult = (query[query.length - 1].type === "field");
			} else {
				fieldResult = !Array.isArray(result);
			}

			if (!format || format === "json") {
				el.createEl('pre', { text: JSON.stringify(result, null, 2), cls: 'QJSON-' + id + ' cdQjson ' + showJson });
			} else {
				if (fieldResult) {
					/*if (selectedFields || !(typeof result === 'object')) {
						new Notice("Non-object field queries ignore field formats");
					}*/
					if (selectedFields) {
						new Notice("Field queries currently ignore field formats");
					}
					if (format === "list") {
						const ul = el.createEl('ul');
						if (typeof result === 'string') {
							ul.createEl('li', { text: result });
						} else if (Array.isArray(result)) {
							for (let i = 0; i < result.length; i++) {
								ul.createEl('li', { text: formatOutput(result[i]) });
							}
						} else if (typeof result === 'object') {
							for (const key of result) {
								const tr = tbody.createEl('tr');
								tr.createEl('th', { text: key });
								tr.createEl('td', { text: formatOutput(result[key]) });
							}
						} else {
							new Notice('unsupported object type');
						}
					} else if (format === "table") {
						const table = el.createEl('table');
						const tbody = table.createEl('tbody');
						if (typeof result === 'string') {
							const tr = tbody.createEl('tr');
							tr.createEl('td', { text: result });
						} else if (Array.isArray(result)) {
							for (let i = 0; i < result.length; i++) {
								const tr = tbody.createEl('tr');
								tr.createEl('td', { text: formatOutput(result[i]) });
							}
						} else if (typeof result === 'object') {
							for (const key of result) {
								const tr = tbody.createEl('tr');
								tr.createEl('th', { text: key });
								tr.createEl('td', { text: formatOutput(result[key]) });
							}
						} else {
							new Notice('unsupported object type');
						}
					} else if (format === "img") {
						if (typeof result === 'string') {
							el.createEl('img', { attr: { src: result } });
						} else if (Array.isArray(result)) {
							let notString = false;
							for (let i = 0; i < result.length; i++) {
								if (typeof result[i] === 'string') {
									el.createEl('img', { attr: { src: result[i], width: 100, height: 100 } });
								} else {
									notString = true;
								}
							}
							if (notString) {
								new Notice('one or more entries could not be rendered');
							}
						} else {
							new Notice('format "img" does not support objects');
						}
					}
				} else {
					// filtered or raw JSON works here
					if (!Array.isArray(result)) {
						new Notice('Table & list can only be created from array');
						el.createEl('pre', { text: 'Table & list can only be created from array' });
						return;
					}
					if (!selectedFields && result.length > 0) {
						if (Array.isArray(result[0]) || typeof result[0] !== 'object') {
							result = result.map(e => { return {entry: e};});
						}
						// just use all fields from the first element
						selectedFields = Object.entries(result[0]).map(([k,v],i) => {return {
								header: false,
								bold: false,
								comma: false,
								br: false,
								link: false,
								name: null,
								field: k,
								field2: null
							};
						});
					}
					let oEl;
					let titleNum = 1;
					if (format === "list") {
						if (selectedFields[0].header && selectedFields[0].name) {
							formatElement(el, selectedFields[0], null, selectedFields[0].name);
						}
						oEl = el.createEl('ul', { attr:{ style:"list-style-position: outside;"}});
					} else if (format === "table") {
						const table = el.createEl('table');
						const thead = table.createEl('thead');
						oEl = table.createEl('tbody');
						const tr = thead.createEl('tr');
						for (const select of selectedFields) {
							const name = select.name || select.field;
							let td = tr.createEl('td');
							td.createEl('b', {text: name});
						}
					}
					let eEl;
					for (const entry of result) {
						if (format === "list") {
							let hEl = oEl.createEl('li');
							if (selectedFields[0].header) {
								formatElement(hEl, selectedFields[0], entry);
							} else {
								hEl.appendText(""+(titleNum++));
							}

							eEl = hEl.createEl('lu', { attr:{ style:"list-style-position: inside;"}});
						} else if (format === "table") {
							eEl = oEl.createEl('tr');
						}
						for (const select of selectedFields) {
							if (format === "list") {
								if (select.header) {
									// header value is already upper list content
									continue;
								}
								let fEl = eEl.createEl('li');
								if (select.name) {
									fEl.appendText(select.name);
								} else {
									fEl.appendText(select.field);
								}
								fEl.appendText(': ');
								formatElement(fEl, select, entry);
							} else if (format === "table") {
								let fEl;
								if (select.header) {
									fEl = eEl.createEl('th');
								} else {
									fEl = eEl.createEl('td');
								}
								formatElement(fEl, select, entry);
							}
						}
					}
				}
				//return;
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

function formatString(template: string, obj:object): string {
	return template.replace(/{([^}]+)}/g, (match, name) => {
		return formatOutput(obj[name]);
	});
}

function formatElement(parent: Element, format: Object, json: Object, text?: string) {
	if (!text) {
		if (format.field) {
			const textJson = json[format.field];
			if (Array.isArray(textJson)) {
				text = textJson.map(j => formatOutput(j));
			} else {
				text = formatOutput(textJson);
			}
		} else {
			text = formatString(format.template, json);
		}
	}

	let el;
	if (format.bold) {
		el = parent.createEl('b');
	} else {
		el = parent;
	}
	
	if (Array.isArray(text)) {
		let idx = 0;
		for (let t of text) {
			if (format.link) {
				el.createEl('a', {text: t, href: json[format.field2][idx]});
			} else {
				el.appendText(t);
			}
			if (idx < text.length-1) {
				if (format.comma) {
					el.appendText(', ');
				} else if (format.br) {
					el.createEl('br');
				} else {
					el.appendText(' ');
				}
			}
			idx++;
		}
	} else {
		if (format.link) {
			el.createEl('a', {text: text, href: json[format.field2]});
		} else {
			el.appendText(text);
		}
	}
}

function formatOutput(json: Object) {
	if (typeof json === 'string') {
		return json;
	} else {
		return  JSON.stringify(json, null, 2);
	}
}
