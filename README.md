# Q-JSON

[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/rooyca/query-json?logo=github&color=ee8449&style=flat-square)](https://github.com/rooyca/query-json/releases/latest)
[![Obsidian plugin release](https://img.shields.io/badge/Obsidian%20plugin%20release-purple?logo=obsidian&style=flat-square)](https://obsidian.md/plugins?id=query-json)

Query JSON is a versatile Obsidian plugin designed to streamline your data retrieval process within your vault. With this tool, you can effortlessly extract and manipulate JSON data directly from your notes or external files.

## How to Use

To utilize Query JSON, simply include the plugin's syntax within your note, encapsulating the JSON data or providing a file reference. Below is an example of the syntax:

~~~markdown
```qjson
#qj-id: 23
#qj-file: data.json
#qj-id-desc: Test data
```
~~~

Then, you can query the data using the following syntax:

```
@23>store.books.0.author;
```

### Flags

Query JSON supports various flags to enhance customization and functionality:

#### `#qj-id` INT (required)

This flag denotes the JSON object identifier. It must be unique and numeric.

#### `#qj-id-ds` (optional)

Short for "id don't show," this flag suppresses the display of the identifier after rendering.

#### `#qj-id-desc` (optional)

Short for "id description," this flag provides a way to describe the JSON object. It is particularly useful for identifying the purpose of the object. The default value is `»»» Query JSON «««`.

#### `#qj-file` (optional)

If provided, this flag specifies the file path containing the JSON data. In its absence, the plugin scans for JSON data within the code block.

## Querying Data

Crafting queries with Query JSON is straightforward, allowing you to refine and extract specific information tailored to your needs. For instance, consider the following JSON data:

```json
{
  "store": {
    "books": [
      {
        "author": "John Doe",
        "title": "The Book"
      }
    ]
  }
}
```

To retrieve the author of the first book within the store, use the following query:

```
@23>store.books.0.author;
```
> [!NOTE]
> 
> Here, `23` represents the object identifier (ID), facilitating precise data extraction.

Furthermore, Query JSON extends its functionality to external JSON files. For example, if you possess a file named `data.json` containing the same JSON data as above, you can use the following query:


```
@data.json>store.books.0.author;
```

Unlock the potential of your JSON data effortlessly with Query JSON, revolutionizing your note-taking experience.