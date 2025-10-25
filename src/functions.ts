export function parseQuery(query) {
    const parts = query.split('.');
    const parsed = parts.map(part => {
        // Check for multi-field selection: {field1,field2,field3}
        const multiFieldMatch = part.match(/^\{([^}]+)\}$/);
        if (multiFieldMatch && multiFieldMatch[1].includes(',')) {
            const fields = multiFieldMatch[1].split(',').map(f => f.trim());
            return {
                type: 'multiField',
                fields: fields
            };
        }
        
        // Check for filter: field[condition] or [condition]
        const filterMatch = part.match(/(\w*)\[(.*)\]/);
        if (filterMatch) {
            return {
                type: 'filter',
                field: filterMatch[1] || null,
                condition: filterMatch[2]
            };
        }
        
        // Check if it's a numeric index
        if (/^\d+$/.test(part)) {
            return {
                type: 'index',
                index: parseInt(part)
            };
        }
        
        // Regular field access
        return {
            type: 'field',
            name: part
        };
    });
    
    // Validation
    let first = true;
    for (const q of parsed) {
        if (first) {
            first = false;
        } else {
            if (q.type === "filter" && !q.field) {
                throw Error(`Filter without field: ${query}`);
            }
        }
    }
    return parsed;
}

function parseCondition(condition) {
    const logicalOperators = ['&&', '||'];
    let conditions = [];
    let operators = [];
    let currentCondition = condition;

    // Parse logical operators sequentially
    for (const operator of logicalOperators) {
        while (currentCondition.includes(operator)) {
            const operatorIndex = currentCondition.indexOf(operator);
            const leftPart = currentCondition.substring(0, operatorIndex).trim();
            
            if (conditions.length === 0) {
                conditions.push(parseSingleCondition(leftPart));
            }
            
            operators.push(operator);
            currentCondition = currentCondition.substring(operatorIndex + operator.length).trim();
        }
    }

    // Add the final condition
    conditions.push(parseSingleCondition(currentCondition));

    return { conditions, operators };
}

function parseSingleCondition(condition) {
    const comparisonOperators = ['>=', '<=', '==', '>', '<', '!=', '*'];
    for (let operator of comparisonOperators) {
        if (condition.includes(operator)) {
            const [key, value] = condition.split(operator).map(s => s.trim());
            return { key, operator, value };
        }
    }
    throw new Error(`Invalid condition: ${condition}`);
}

export function executeQuery(json, parsedQuery) {
    let result = json;

    for (let i = 0; i < parsedQuery.length; i++) {
        const part = parsedQuery[i];
        
        if (part.type === 'field') {
            if (Array.isArray(result)) {
                result = result.map(item => item[part.name]).filter(item => item !== undefined);
            } else if (result && typeof result === 'object') {
                result = result[part.name];
            }
        } else if (part.type === 'index') {
            if (Array.isArray(result)) {
                result = result[part.index];
            } else {
                return undefined; // Can't index into non-array
            }
        } else if (part.type === 'multiField') {
            if (Array.isArray(result)) {
                // Extract multiple fields from each item in the array
                result = result.map(item => {
                    const extracted = {};
                    part.fields.forEach(field => {
                        if (item && item.hasOwnProperty(field)) {
                            extracted[field] = item[field];
                        }
                    });
                    return extracted;
                });
            } else if (result && typeof result === 'object') {
                // Extract multiple fields from a single object
                const extracted = {};
                part.fields.forEach(field => {
                    if (result.hasOwnProperty(field)) {
                        extracted[field] = result[field];
                    }
                });
                result = extracted;
            }
        } else if (part.type === 'filter') {
            const { conditions, operators } = parseCondition(part.condition);
            let arrayToFilter = result;
            
            if (part.field) {
                arrayToFilter = result[part.field];
            }
            
            if (Array.isArray(arrayToFilter)) {
                result = arrayToFilter.filter(item => {
                    return evaluateConditions(item, conditions, operators);
                });
            }
        }
    }

    return result;
}

function evaluateConditions(item, conditions, operators) {
    if (conditions.length === 0) return true;
    
    let result = evaluateCondition(item, conditions[0]);

    for (let i = 0; i < operators.length; i++) {
        const operator = operators[i];
        const nextConditionResult = evaluateCondition(item, conditions[i + 1]);

        if (operator === '&&') {
            result = result && nextConditionResult;
        } else if (operator === '||') {
            result = result || nextConditionResult;
        }
    }

    return result;
}

function evaluateCondition(item, condition) {
    const { key, operator, value } = condition;
    const itemValue = item[key];
    
    switch (operator) {
        case '*': 
            return true;
        case '>=': 
            return Number(itemValue) >= Number(value);
        case '<=': 
            return Number(itemValue) <= Number(value);
        case '==': 
            return itemValue == value;
        case '>': 
            return Number(itemValue) > Number(value);
        case '<': 
            return Number(itemValue) < Number(value);
        case '!=': 
            return itemValue != value;
        default: 
            return false;
    }
}

export function formatOutput(json: Object) {
	if (typeof json === 'string') {
		return json;
	} else {
		return  JSON.stringify(json, null, 2);
	}
}

export function getJSONPath(json: Object, path: string) {
	if (path === '') return json;
	return path.split('.').reduce((acc, key) => acc[key], json);
}

export function formatString(template: string, obj:object): string {
	return template.replace(/{([^}]+)}/g, (match, name) => {
		return formatOutput(obj[name]);
	});
}



