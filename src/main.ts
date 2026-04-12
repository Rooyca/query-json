import { Notice, Plugin } from 'obsidian';
import { parseQuery, formatString, executeQuery, formatOutput, getJSONPath, QueryPart } from './functions';

interface SelectedField {
	header: boolean;
	bold: boolean;
	comma: boolean;
	br: boolean;
	link: boolean;
	name: string | null;
	field: string | null;
	template: string | null;
	field2: string | null;
}

export default class QJSON extends Plugin {
	private statusBarItemEl: HTMLElement;
	private countTimeout: NodeJS.Timeout | null = null;
	private lastDuplicateIds: string = '';

	async onload() {
		this.statusBarItemEl = this.addStatusBarItem();
		this.statusBarItemEl.setText('');

		// Update counter when file opens
		this.registerEvent(this.app.workspace.on('file-open', async (file) => {
			if (file) {
				await this.countQjsonBlocks();
			} else {
				// No file open, hide counter
				this.statusBarItemEl.setText('');
			}
		}));

		// Update counter when active leaf changes (switching between tabs)
		this.registerEvent(this.app.workspace.on('active-leaf-change', async () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				await this.countQjsonBlocks();
			} else {
				this.statusBarItemEl.setText('');
			}
		}));

		// Update counter when document is edited
		this.registerEvent(this.app.workspace.on('editor-change', async (editor) => {
			// Debounce the counting to avoid excessive updates while typing
			if (this.countTimeout) {
				clearTimeout(this.countTimeout);
			}
			this.countTimeout = setTimeout(async () => {
				await this.countQjsonBlocks();
			}, 1000);
		}));

		this.registerMarkdownCodeBlockProcessor("qjson", async (source, el) => {
			if (!source.includes('#qj-id:')) {
				new Notice('No ID found');
				el.createEl('pre', { text: 'No ID found' });
				return;
			}
			const idMatch = source.match(/^#qj-id: (\d+)$/m);
			const id = idMatch?.[1] ?? null;
			if (!id || Number.isNaN(Number.parseInt(id, 10))) {
				new Notice('ID must be a number');
				el.createEl('pre', { text: 'ID must be a number' });
				return;
			}

			let query: QueryPart[] | null = null;

			if (source.includes('#qj-query:')) {
				const queryMatch = source.match(/^#qj-query: ([^\n\r]+)$/m);
				let queryText = queryMatch?.[1] ?? null;
				if (!queryText) {
					new Notice('No query found');
					el.createEl('pre', { text: 'No query found' });
					return;
				}

				const activeFile = this.app.workspace.getActiveFile();
				const properties = activeFile ? this.app.metadataCache.getFileCache(activeFile) : null;
				if (properties && properties.frontmatter) {
					for (const key in properties.frontmatter) {
						const replacement = String(properties.frontmatter[key]);
						queryText = queryText.replace(new RegExp(`{this.${key}}`, 'g'), replacement);
					}
				}
				try {
					query = parseQuery(queryText);
				} catch (error) {
					new Notice(`Invalid query: ${error instanceof Error ? error.message : 'unknown error'}`);
					el.createEl('pre', { text: 'Invalid query' });
					return;
				}
			}


			let format: string | null = null;
			let selectedFields: SelectedField[] | null = null;

			if (source.includes('#qj-format:')) {
				const formatMatch = source.match(/^#qj-format: ([^\[\n\r ]+)[\t\f ]*(?:\[((?:[^\]\n\r=:,\"]*:(?:[^\]\n\r=:,\"]+|"[^\"]+")(?::[^\]\n\r=,]+)?(?:=[^\]\n\r,]+)?(?:,[^\n\r\w]*)?)+)\])?$/m);
				if (formatMatch) {
					if (formatMatch[2]) {
						const formats = formatMatch[2].split(/(?<=[^\]\n\r=:,\"]*:(?:[^\]\n\r=:,\"]+|"[^\"]+")(?::[^\]\n\r=,]+)?(?:=[^\]\n\r,]+)?)[\t\f ]*,/);
						const mappedFormats = formats.map(f => {
							const fParts = f.match(/^([^\]\n\r=:,\"]*):(?:([^\]\n\r=:,\"]+)|"([^\"]+)")(?::([^\]\n\r=,]+))?(?:=([^\]\n\r,]+))?$/);
							if (!fParts) {
								return null;
							}
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
						if (mappedFormats.some((f) => f === null)) {
							new Notice('No format found');
							el.createEl('pre', { text: 'No format found' });
							return;
						}
						selectedFields = mappedFormats as SelectedField[];
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
					format = formatMatch[1];
				} else {
					new Notice('No format found');
					el.createEl('pre', { text: 'No format found' });
					return;
				}
			}

			let desc: string | null = null;

			if (!source.includes('#qj-hide-id')) {
				const descMatch = source.match(/^#qj-desc: ([^\n\r]+)$/m);
				desc = descMatch?.[1] ?? "»»» QJSON «««";
				el.createEl('h3', { text: desc, cls: 'centerQJtext' });
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
						source = await this.app.vault.adapter.read(file[1]);
					} catch {
						const activeFile = this.app.workspace.getActiveFile();
						if (!activeFile || !activeFile.parent) {
							new Notice('No file open to resolve relative JSON path');
							el.createEl('pre', { text: 'No file open to resolve relative JSON path' });
							return;
						}
						const filePath = activeFile.parent.path + '/';
						try {
							source = await this.app.vault.adapter.read(filePath + file[1]);
						} catch {
							new Notice('No file given');
							el.createEl('pre', { text: 'No file given' });
							return;
						}
					}
				} else {
					new Notice('No file given');
					el.createEl('pre', { text: 'No file given' });
					return;
				}
			} else {
				source = source.replace(/^#qj-[a-z]+(: )?.*$/gm, "");
			}
			
			let json: unknown;
			try {
				json = JSON.parse(source);
			} catch {
				new Notice('Invalid JSON');
				el.createEl('pre', { text: 'Invalid JSON' });
				return;
			}

			let result: unknown = json;
			let fieldResult = !Array.isArray(result);

			if (query) {
				result = executeQuery(json, query);
				fieldResult = query[query.length - 1]?.type === "field";
			}

			if (!format || format === "json") {
				el.createEl('pre', { text: formatOutput(result), cls: 'QJSON-' + id + ' cdQjson ' + showJson });
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
						} else if (result && typeof result === 'object') {
							for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
								const li = ul.createEl('li');
								li.appendText(`${key}: ${formatOutput(value)}`);
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
						} else if (result && typeof result === 'object') {
							for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
								const tr = tbody.createEl('tr');
								tr.createEl('th', { text: key });
								tr.createEl('td', { text: formatOutput(value) });
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
					let arrayResult = result as unknown[];
					if (!selectedFields && arrayResult.length > 0) {
						if (Array.isArray(arrayResult[0]) || typeof arrayResult[0] !== 'object') {
							arrayResult = arrayResult.map((e) => ({ entry: e }));
							result = arrayResult;
						}
						// just use all fields from the first element
						selectedFields = Object.entries(arrayResult[0] as Record<string, unknown>).map(([k]) => {return {
								header: false,
								bold: false,
								comma: false,
								br: false,
								link: false,
								name: null,
								field: k,
								template: null,
								field2: null
							};
						});
					}
					if (!selectedFields || selectedFields.length === 0) {
						new Notice('No fields found to render');
						el.createEl('pre', { text: 'No fields found to render' });
						return;
					}
					let oEl: HTMLElement;
					let titleNum = 1;
					if (format === "list") {
						if (selectedFields[0].header && selectedFields[0].name) {
							formatElement(el, selectedFields[0], {}, selectedFields[0].name);
						}
						oEl = el.createEl('ul', { attr:{ style:"list-style-position: outside;"}});
					} else if (format === "table") {
						const table = el.createEl('table');
						const thead = table.createEl('thead');
						oEl = table.createEl('tbody');
						const tr = thead.createEl('tr');
						for (const select of selectedFields) {
							const name = select.name || select.field || '';
							const td = tr.createEl('td');
							td.createEl('b', {text: name});
						}
					} else {
						return;
					}
					let eEl: HTMLElement;
					for (const entry of arrayResult) {
						if (format === "list") {
							const hEl = oEl.createEl('li');
							if (selectedFields[0].header) {
								formatElement(hEl, selectedFields[0], (entry as Record<string, unknown>) ?? {});
							} else {
								hEl.appendText(""+(titleNum++));
							}

							eEl = hEl.createEl('ul', { attr:{ style:"list-style-position: inside;"}});
						} else if (format === "table") {
							eEl = oEl.createEl('tr');
						} else {
							return;
						}
						for (const select of selectedFields) {
							if (format === "list") {
								if (select.header) {
									// header value is already upper list content
									continue;
								}
								const fEl = eEl.createEl('li');
								if (select.name) {
									fEl.appendText(select.name);
								} else {
									fEl.appendText(select.field || '');
								}
								fEl.appendText(': ');
								formatElement(fEl, select, (entry as Record<string, unknown>) ?? {});
							} else if (format === "table") {
								let fEl: HTMLElement;
								if (select.header) {
									fEl = eEl.createEl('th');
								} else {
									fEl = eEl.createEl('td');
								}
								formatElement(fEl, select, (entry as Record<string, unknown>) ?? {});
							}
						}
					}
				}
				//return;
			}

		});

		this.registerEvent(this.app.workspace.on('editor-change', async (editor) => {
			const cursor = editor.getCursor();
			const line = editor.getLine(cursor.line);
			const lastChar = line[line.length - 1];
			if (lastChar !== ';' && lastChar !== '.' && lastChar !== '>' && lastChar !== ']') return;
			const atIndex = line.lastIndexOf('@');
			if (atIndex === -1) return;
			const queryPart = line.slice(atIndex);
			const match = queryPart.match(/^@([^>]+)>(.*)$/);
			if (!match) return;

			const id = match[1].trim();
			const rawPath = match[2];
			const path = rawPath.length > 0 ? rawPath.slice(0, -1).trim() : '';

			const json = await this.resolveJsonSource(id);
			if (json === undefined) return;
			let value = this.evaluateInlinePath(json, path);

			if (lastChar !== ';') {
				if (value !== undefined) {
					const notice = document.querySelector('.notice');
					if (notice) notice.remove();

					if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
						new Notice(value.toString());
					} else if (value && typeof value === 'object') {
						const keys = Object.keys(value as Record<string, unknown>);
						const keysAreNumbers = keys.every((key) => !Number.isNaN(Number.parseInt(key, 10)));
						if (keysAreNumbers) {
							new Notice('Total Keys: ' + keys.length);
						} else {
							new Notice('Total Keys: ' + keys.length + '\n' + '____________' + '\n' + keys.join('\n'));
						}
					}
				} 
			} else {
				const replaceEnd = { line: cursor.line, ch: line.length }; // Replace to end of line
				const stringValue = typeof value === 'string' ? value : formatOutput(value);
				editor.replaceRange(stringValue, { line: cursor.line, ch: atIndex }, replaceEnd);
			}
		}));

	}

	private async resolveJsonSource(id: string): Promise<unknown | undefined> {
		if (!Number.isNaN(Number.parseInt(id, 10)) && !id.includes('.json')) {
			const jsonEl = document.querySelector('.QJSON-' + id) as HTMLElement | null;
			if (!jsonEl?.textContent) {
				return undefined;
			}
			try {
				return JSON.parse(jsonEl.textContent);
			} catch {
				new Notice('Invalid JSON source for ID ' + id);
				return undefined;
			}
		}
		try {
			const source = await this.app.vault.adapter.read(id);
			return JSON.parse(source);
		} catch {
			try {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || !activeFile.parent) {
					return undefined;
				}
				const source = await this.app.vault.adapter.read(`${activeFile.parent.path}/${id}`);
				return JSON.parse(source);
			} catch {
				new Notice(`Unable to load JSON file: ${id}`);
				return undefined;
			}
		}
	}

	private evaluateInlinePath(json: unknown, path: string): unknown {
		if (!path) {
			return json;
		}
		try {
			return executeQuery(json, parseQuery(path));
		} catch {
			const cleanPath = path.replace(/\*/g, '').replace(/\[\]/g, '');
			return getJSONPath(json, cleanPath);
		}
	}

	private async countQjsonBlocks() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			this.statusBarItemEl.setText('');
			return;
		}

		try {
			const content = await this.app.vault.read(activeFile);

			// Match all qjson code blocks with #qj-id: number
			const qjsonBlockRegex = /```qjson[\s\S]*?#qj-id:\s*(\d+)/g;
			const matches = content.matchAll(qjsonBlockRegex);

			const ids = new Set<string>();
			const duplicateIds = new Set<string>();

			for (const match of matches) {
				const id = match[1];
				if (ids.has(id)) {
					duplicateIds.add(id);
				} else {
					ids.add(id);
				}
			}

			// Show duplicates warning only when changed, to avoid spamming on every keypress.
			if (duplicateIds.size > 0) {
				const duplicateKey = Array.from(duplicateIds).sort().join(',');
				if (duplicateKey !== this.lastDuplicateIds) {
					new Notice(`Duplicate QJSON IDs found: ${Array.from(duplicateIds).join(', ')}`);
					this.lastDuplicateIds = duplicateKey;
				}
			} else {
				this.lastDuplicateIds = '';
			}

			// Only count unique IDs
			const uniqueCount = ids.size;

			// Update status bar
			if (uniqueCount > 0) {
				this.statusBarItemEl.setText(`${uniqueCount} qjson`);
			} else {
				this.statusBarItemEl.setText('');
			}
		} catch (error) {
			console.error('Error counting QJSON blocks:', error);
			this.statusBarItemEl.setText('');
		}
	}

	onunload() {
		this.statusBarItemEl.setText('');
	}
}


function formatElement(
	parent: Element,
	format: SelectedField,
	json: Record<string, unknown>,
	text?: string | string[]
): void {
	if (!text) {
		if (format.field) {
			const textJson = json[format.field];
			if (Array.isArray(textJson)) {
				text = textJson.map((j) => formatOutput(j));
			} else {
				text = formatOutput(textJson);
			}
		} else if (format.template) {
			text = formatString(format.template, json);
		} else {
			text = '';
		}
	}

	const el = format.bold ? parent.createEl('b') : parent;
	
	if (Array.isArray(text)) {
		let idx = 0;
		for (const t of text) {
			if (format.link) {
				const links = format.field2 ? json[format.field2] : undefined;
				const href = Array.isArray(links) ? String(links[idx] ?? '') : '';
				el.createEl('a', { text: t, href });
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
			const href = format.field2 ? String(json[format.field2] ?? '') : '';
			el.createEl('a', { text, href });
		} else {
			el.appendText(text);
		}
	}
}
