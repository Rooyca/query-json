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
			// check if id is a number
			if (isNaN(id)) {
				new Notice('ID must be a number');
				el.createEl('pre', {text: 'ID must be a number'});
				return;
			}

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

		  const match = line.match(/@>(.+);(.+)/);
		  if (!match) return;
		  const id = match[1];
		  const path = match[2];
		  let json;

		  if (!isNaN(parseInt(id)) && !id.includes('.json')) {
		    const el = document.querySelector('.QJSON-' + id);
			if (!el) return;
		  	json = JSON.parse(el.innerText);
		  } else {
		  	json = JSON.parse(await this.app.vault.adapter.read(id));
		  }

		  const lastChar = line[line.length - 1];
		  const value = getJSONPath(json, path.replace(/;/, ''));

		  if (lastChar !== ';') {
		    if (value !== undefined) {
			  	const notice = document.querySelector('.notice');
			  	if (notice) notice.remove();
			  	
		    	const keys = Object.keys(value);
		    	const keysAreNumbers = keys.every(key => !isNaN(parseInt(key)));

				if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
					new Notice(value.toString());
		    	} else if (keysAreNumbers) {
		    		new Notice('Total Keys: ' + (keys.length- 1 ));
		    	} else {
		    		new Notice('Total Keys: ' + keys.length + '\n' + '____________' + '\n' + keys.join('\n'));
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
