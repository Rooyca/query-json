import { App, Notice, Plugin } from 'obsidian';

export default class QJSON extends Plugin {

	async onload() {
		const statusBarItemEl = this.addStatusBarItem();
		var qjCount = document.querySelectorAll('.notHere').length;
		statusBarItemEl.setText('QJSON: ' + qjCount);

		this.registerMarkdownCodeBlockProcessor("qjson", async (source, el, ctx) => {
			if (!source.includes('#qj-id:')) {
				new Notice('No ID found');
				el.createEl('pre', {text: 'No ID found'});
				return;
			}

			const id = source.match(/#qj-id: (\d+)/)[1];

			if (!source.includes('#qj-id-ds')) {
				var desc;
				try {
					desc = source.match(/#qj-id-desc: (.+)/)[1];
				} catch (e) {
					desc = "»»» Query JSON «««";
				}
				el.createEl('h3', {text: desc});
				el.createEl('h4', {text: "ID: " + id});
			}

			if (source.includes('#qj-file:')) {
				const file = source.match(/#qj-file: (.+)/)[1];
				const response = await this.app.vault.adapter.read(file);
				source = response;
			}

			const json = JSON.parse(source);
			el.createEl('pre', {text: JSON.stringify(json, null, 2), cls: 'QJSON-'+id+' notHere'});

			var qjCount = document.querySelectorAll('.notHere').length;
			statusBarItemEl.setText('QJSON: ' + qjCount);
		});

		this.app.workspace.on('editor-change', async () => {
	        const editor = this.app.workspace.activeLeaf.view.sourceMode.cmEditor;
	        const cursor = editor.getCursor();
	        const line_t = editor.getLine(cursor.line);
	        const match = line_t.match(/@>(\d+);(.+);/);
	        if (match) {
	        	const id = match[1];
	        	const path = match[2];
	        	const el = document.querySelector('.QJSON-'+id);
	        	if (!el) return;
	        	const json = JSON.parse(el.innerText);
	        	const value = path.split('.').reduce((acc, key) => acc[key], json);
			    const atIndex = line_t.indexOf('@>');
			    const lastSemicolonIndex = line_t.lastIndexOf(';');
			    const replaceStart = { line: cursor.line, ch: atIndex };
			    const replaceEnd = { line: cursor.line, ch: lastSemicolonIndex + 1 };
			    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
			    editor.replaceRange(stringValue, replaceStart, replaceEnd);
	        }
		});

	}

}
