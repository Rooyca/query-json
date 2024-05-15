# QUERY JSON

Query JSON is a simple Obsidian plugin that allows you to query JSON in your vault. You can import the files directly into your notes, or you can paste the JSON data in a code block.

~~~markdown
```qjson
#qj-id: 23
#qj-file: data.json
#qj-id-desc: Test data
```
~~~

## FLAGS

### `#qj-id` (required)

JSON object identifier.

### `#qj-id-ds` (optional)

(Stands for "id don't show") 

If present, it shows nothing after the code block is rendered.

### `#qj-id-desc` (optional)

(Stands for "id description") 

A short description of the JSON. Default is `»»» Query JSON «««`.

### `#qj-file` (optional)

File path. If not present, the plugin will search for the JSON data inside the code block.

## QUERY

The query is a simple expression. You can use the query to filter the data you want to show in your note. For instance, if you have JSON data like this:

```json
{
  "store": {
	"books": [
	  {
		"author": "John Doe",
		"title": "The book"
	  }
	]
  }
}
```
You can use the following query:

```
@>23;store.books.0.author;
```

It will show the author of the first book in the store. The `23` is the object identifier (ID).
