type Primitive = string | number | boolean | null;
type JsonValue = Primitive | JsonObject | JsonArray;
interface JsonObject {
	[key: string]: JsonValue;
}
type JsonArray = JsonValue[];

export type QueryPart =
	| { type: 'field'; name: string }
	| { type: 'index'; index: number }
	| { type: 'indexList'; field: string | null; indices: number[] }
	| { type: 'slice'; field: string | null; start: number | null; end: number | null }
	| { type: 'multiField'; fields: string[] }
	| { type: 'filter'; field: string | null; condition: string };

type LogicalOperator = '&&' | '||';
type ComparisonOperator = '>=' | '<=' | '==' | '!=' | '>' | '<' | '*';
interface Condition {
	key: string;
	operator: ComparisonOperator;
	value: string;
}

function splitByTopLevelDot(query: string): string[] {
	const parts: string[] = [];
	let current = '';
	let bracketDepth = 0;
	let braceDepth = 0;
	let quote: '"' | "'" | null = null;

	for (const ch of query) {
		if (quote) {
			current += ch;
			if (ch === quote) {
				quote = null;
			}
			continue;
		}

		if (ch === '"' || ch === "'") {
			quote = ch;
			current += ch;
			continue;
		}
		if (ch === '[') bracketDepth++;
		if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
		if (ch === '{') braceDepth++;
		if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);

		if (ch === '.' && bracketDepth === 0 && braceDepth === 0) {
			parts.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	parts.push(current);
	return parts.filter((part) => part.length > 0);
}

function parseIndexList(content: string): number[] | null {
	const trimmed = content.trim();
	if (!/^\d+(?:\s*,\s*\d+)*$/.test(trimmed)) {
		return null;
	}
	return trimmed.split(',').map((part) => Number.parseInt(part.trim(), 10));
}

function parseSlice(content: string): { start: number | null; end: number | null } | null {
	const trimmed = content.trim();
	const match = trimmed.match(/^(\d*)\s*:\s*(\d*)$/);
	if (!match) {
		return null;
	}
	const start = match[1] === '' ? null : Number.parseInt(match[1], 10);
	const end = match[2] === '' ? null : Number.parseInt(match[2], 10);
	return { start, end };
}

export function parseQuery(query: string): QueryPart[] {
	const parts = splitByTopLevelDot(query.trim());
	const parsed = parts.map((part): QueryPart => {
		const multiFieldMatch = part.match(/^\{([^}]+)\}$/);
		if (multiFieldMatch) {
			const fields = multiFieldMatch[1]
				.split(',')
				.map((f) => f.trim())
				.filter((f) => f.length > 0);
			if (fields.length === 0) {
				throw new Error(`Invalid multi-field selector: ${part}`);
			}
			return { type: 'multiField', fields };
		}

		const filterMatch = part.match(/^(\w*)\[(.*)\]$/);
		if (filterMatch) {
			const field = filterMatch[1] || null;
			const condition = filterMatch[2].trim();
			const indexList = parseIndexList(condition);
			if (indexList) {
				return {
					type: 'indexList',
					field,
					indices: indexList,
				};
			}
			const slice = parseSlice(condition);
			if (slice) {
				return {
					type: 'slice',
					field,
					start: slice.start,
					end: slice.end,
				};
			}
			return {
				type: 'filter',
				field,
				condition,
			};
		}

		if (/^\d+$/.test(part)) {
			return {
				type: 'index',
				index: Number.parseInt(part, 10),
			};
		}

		return {
			type: 'field',
			name: part,
		};
	});

	let isFirst = true;
	for (const q of parsed) {
		if (isFirst) {
			isFirst = false;
			continue;
		}
		if (q.type === 'filter' && !q.field) {
			throw new Error(`Filter without field: ${query}`);
		}
	}
	return parsed;
}

function splitLogicalExpression(condition: string): {
	conditions: string[];
	operators: LogicalOperator[];
} {
	const conditions: string[] = [];
	const operators: LogicalOperator[] = [];
	let current = '';
	let quote: '"' | "'" | null = null;

	for (let i = 0; i < condition.length; i++) {
		const ch = condition[i];
		const next = condition[i + 1];

		if (quote) {
			current += ch;
			if (ch === quote) {
				quote = null;
			}
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			current += ch;
			continue;
		}

		if (ch === '&' && next === '&') {
			conditions.push(current.trim());
			operators.push('&&');
			current = '';
			i++;
			continue;
		}
		if (ch === '|' && next === '|') {
			conditions.push(current.trim());
			operators.push('||');
			current = '';
			i++;
			continue;
		}
		current += ch;
	}
	conditions.push(current.trim());
	return { conditions, operators };
}

function parseCondition(condition: string): {
	conditions: Condition[];
	operators: LogicalOperator[];
} {
	const split = splitLogicalExpression(condition);
	return {
		conditions: split.conditions.map((c) => parseSingleCondition(c)),
		operators: split.operators,
	};
}

function parseSingleCondition(condition: string): Condition {
	const trimmed = condition.trim();
	if (trimmed === '*') {
		return { key: '', operator: '*', value: '' };
	}

	const comparisonOperators: ComparisonOperator[] = ['>=', '<=', '==', '!=', '>', '<'];
	for (const operator of comparisonOperators) {
		const idx = trimmed.indexOf(operator);
		if (idx > -1) {
			const key = trimmed.slice(0, idx).trim();
			const value = trimmed.slice(idx + operator.length).trim();
			if (!key || !value) {
				throw new Error(`Invalid condition: ${condition}`);
			}
			return { key, operator, value };
		}
	}
	throw new Error(`Invalid condition: ${condition}`);
}

function parseLiteral(value: string): JsonValue {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	if (trimmed === 'true') return true;
	if (trimmed === 'false') return false;
	if (trimmed === 'null') return null;
	if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
	return trimmed;
}

function applyIndexList(array: unknown[], indices: number[]): unknown[] {
	const selected: unknown[] = [];
	for (const index of indices) {
		if (!Number.isInteger(index) || index < 0 || index >= array.length) {
			continue;
		}
		selected.push(array[index]);
	}
	return selected;
}

function applySlice(array: unknown[], start: number | null, end: number | null): unknown[] {
	const from = start ?? 0;
	const to = end ?? array.length;
	return array.slice(from, to);
}

export function executeQuery(json: unknown, parsedQuery: QueryPart[]): unknown {
	let result: unknown = json;

	for (const part of parsedQuery) {
		if (result === undefined) {
			return undefined;
		}

		if (part.type === 'field') {
			if (Array.isArray(result)) {
				result = result
					.map((item) => (item && typeof item === 'object' ? (item as JsonObject)[part.name] : undefined))
					.filter((item): item is JsonValue => item !== undefined);
			} else if (result && typeof result === 'object') {
				result = (result as JsonObject)[part.name];
			} else {
				return undefined;
			}
			continue;
		}

		if (part.type === 'index') {
			if (!Array.isArray(result)) {
				return undefined;
			}
			result = result[part.index];
			continue;
		}

		if (part.type === 'indexList') {
			let arrayToIndex: unknown = result;
			if (part.field) {
				if (!result || typeof result !== 'object' || Array.isArray(result)) {
					return undefined;
				}
				arrayToIndex = (result as JsonObject)[part.field];
			}
			if (!Array.isArray(arrayToIndex)) {
				return undefined;
			}
			result = applyIndexList(arrayToIndex, part.indices);
			continue;
		}

		if (part.type === 'slice') {
			let arrayToSlice: unknown = result;
			if (part.field) {
				if (!result || typeof result !== 'object' || Array.isArray(result)) {
					return undefined;
				}
				arrayToSlice = (result as JsonObject)[part.field];
			}
			if (!Array.isArray(arrayToSlice)) {
				return undefined;
			}
			result = applySlice(arrayToSlice, part.start, part.end);
			continue;
		}

		if (part.type === 'multiField') {
			if (Array.isArray(result)) {
				const allNumeric = part.fields.every((field) => /^\d+$/.test(field));
				if (allNumeric) {
					const indices = part.fields.map((field) => Number.parseInt(field, 10));
					result = applyIndexList(result, indices);
				} else {
					result = result.map((item) => {
						if (!item || typeof item !== 'object' || Array.isArray(item)) {
							return {};
						}
						const source = item as JsonObject;
						const extracted: JsonObject = {};
						for (const field of part.fields) {
							if (Object.prototype.hasOwnProperty.call(source, field)) {
								extracted[field] = source[field];
							}
						}
						return extracted;
					});
				}
			} else if (result && typeof result === 'object' && !Array.isArray(result)) {
				const source = result as JsonObject;
				const extracted: JsonObject = {};
				for (const field of part.fields) {
					if (Object.prototype.hasOwnProperty.call(source, field)) {
						extracted[field] = source[field];
					}
				}
				result = extracted;
			}
			continue;
		}

		if (part.type === 'filter') {
			const { conditions, operators } = parseCondition(part.condition);
			let arrayToFilter: unknown = result;

			if (part.field) {
				if (!result || typeof result !== 'object' || Array.isArray(result)) {
					return undefined;
				}
				arrayToFilter = (result as JsonObject)[part.field];
			}

			if (!Array.isArray(arrayToFilter)) {
				return undefined;
			}
			result = arrayToFilter.filter((item) => evaluateConditions(item, conditions, operators));
		}
	}

	return result;
}

function getValueByPath(obj: JsonObject, path: string): unknown {
	const cleaned = path.startsWith('.') ? path.slice(1) : path;
	if (cleaned === '') {
		return undefined;
	}
	return cleaned.split('.').reduce<unknown>((acc, key) => {
		if (acc === null || acc === undefined) {
			return undefined;
		}
		if (Array.isArray(acc)) {
			if (!/^\d+$/.test(key)) {
				return undefined;
			}
			const index = Number.parseInt(key, 10);
			return acc[index];
		}
		if (typeof acc !== 'object') {
			return undefined;
		}
		return (acc as JsonObject)[key];
	}, obj);
}

function evaluateConditions(item: unknown, conditions: Condition[], operators: LogicalOperator[]): boolean {
	if (conditions.length === 0) return true;
	let result = evaluateCondition(item, conditions[0]);
	for (let i = 0; i < operators.length; i++) {
		const next = evaluateCondition(item, conditions[i + 1]);
		result = operators[i] === '&&' ? result && next : result || next;
	}
	return result;
}

function evaluateCondition(item: unknown, condition: Condition): boolean {
	if (condition.operator === '*') {
		return true;
	}
	if (!item || typeof item !== 'object' || Array.isArray(item)) {
		return false;
	}

	const obj = item as JsonObject;
	const itemValue = getValueByPath(obj, condition.key);
	const queryValue = parseLiteral(condition.value);

	switch (condition.operator) {
		case '==':
			return itemValue === queryValue;
		case '!=':
			return itemValue !== queryValue;
		case '>':
		case '>=':
		case '<':
		case '<=': {
			const left = Number(itemValue);
			const right = Number(queryValue);
			if (Number.isNaN(left) || Number.isNaN(right)) {
				return false;
			}
			if (condition.operator === '>') return left > right;
			if (condition.operator === '>=') return left >= right;
			if (condition.operator === '<') return left < right;
			return left <= right;
		}
		default:
			return false;
	}
}

export function formatOutput(json: unknown): string {
	if (typeof json === 'string') return json;
	if (json === undefined) return 'undefined';
	return JSON.stringify(json, null, 2);
}

export function getJSONPath(json: unknown, path: string): unknown {
	if (path === '') return json;
	return path.split('.').reduce<unknown>((acc, key) => {
		if (acc === null || acc === undefined) {
			return undefined;
		}
		if (typeof acc !== 'object') {
			return undefined;
		}
		return (acc as Record<string, unknown>)[key];
	}, json);
}

export function formatString(template: string, obj: Record<string, unknown>): string {
	return template.replace(/{([^}]+)}/g, (_, name: string) => formatOutput(obj[name]));
}
