import { App, Notice, Plugin } from 'obsidian';

export default class QJSON extends Plugin {

	async onload() {
		const statusBarItemEl = this.addStatusBarItem();
		let qjCount;
		qjCount = document.querySelectorAll('.notHere').length;
		statusBarItemEl.setText('QJSON: ' + qjCount);

		this.registerMarkdownCodeBlockProcessor("qjson", async (source, el, ctx) => {
			if (!source.includes('#qj-id:')) {
				new Notice('No ID found');
				el.createEl('pre', {text: 'No ID found'});
				return;
			}

			const id = source.match(/#qj-id: (\d+)/)[1];

			let desc;

			if (!source.includes('#qj-id-ds')) {
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

			qjCount = document.querySelectorAll('.notHere').length;
			statusBarItemEl.setText('QJSON: ' + qjCount);
		});

		this.registerEvent(this.app.workspace.on('editor-change', async (editor, info) => {
		  const cursor = editor.getCursor();
		  const line = editor.getLine(cursor.line);

		  const match = line.match(/@>(\d+);(.+)/);
		  if (!match) return;
		  const id = match[1];
		  const path = match[2];

		  const el = document.querySelector('.QJSON-' + id);
		  if (!el) return;
		  const json = JSON.parse(el.innerText);

		  const lastChar = line[line.length - 1];
		  const value = getJSONPath(json, path.replace(/;/, ''));

		  if (lastChar !== ';') {
		    if (value !== undefined) {
		    	if (JSON.stringify(value).length > 400) {
		    		new Notice(JSON.stringify(value, null, 2).substring(0, 300)+'...');
		    	} else {
		    		new Notice(JSON.stringify(value, null, 2));
		    	}
		    } 
		  } else {
		    const atIndex = line.indexOf('@>');
		    const replaceEnd = { line: cursor.line, ch: line.length }; // Replace to end of line
		    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
		    editor.replaceRange(stringValue, { line: cursor.line, ch: atIndex }, replaceEnd);
		  }
		}));
	}

}

function getJSONPath(json, path) {
	  return path.split('.').reduce((acc, key) => acc[key], json);
}
