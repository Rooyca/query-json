export function parseQuery(query) {
    const parts = query.split('.');
    return parts.map(part => {
        const match = part.match(/(\w+)\[(.*)\]/);
        if (match) {
            return {
                type: 'filter',
                field: match[1],
                condition: match[2]
            };
        }
        return {
            type: 'field',
            name: part
        };
    });
}

function parseCondition(condition) {
    const logicalOperators = ['&&', '||'];
    let conditions = [];
    let operators = [];

    let remainingCondition = condition;
    logicalOperators.forEach(operator => {
        if (remainingCondition.includes(operator)) {
            const parts = remainingCondition.split(operator).map(s => s.trim());
            conditions.push(parseSingleCondition(parts[0]));
            operators.push(operator);
            remainingCondition = parts[1];
        }
    });

    if (conditions.length === 0) {
        conditions.push(parseSingleCondition(remainingCondition));
    } else {
        conditions.push(parseSingleCondition(remainingCondition));
    }

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
    let finalResult;

    parsedQuery.forEach(part => {
        if (part.type === 'field') {
            result = result[part.name];
        } else if (part.type === 'filter') {
            const { conditions, operators } = parseCondition(part.condition);
            const filteredResult = result[part.field].filter(item => {
                return evaluateConditions(item, conditions, operators);
            });
            // Store the filtered result in finalResult
            if (!finalResult) {
                finalResult = filteredResult;
            } else {
                // Merge the filtered result with finalResult
                finalResult = finalResult.concat(filteredResult);
            }
        }
    });

    // If no filter conditions were applied, finalResult will be undefined, so set it to the original result
    finalResult = finalResult || result;

    try {
        if (parsedQuery.length > 0 && parsedQuery[parsedQuery.length - 1].type === 'field') {
            // Map only the required field from finalResult if the last part of the query is a 'field' type
            finalResult = finalResult.map(item => item[parsedQuery[parsedQuery.length - 1].name]);
        }
    } catch (e) {
        console.error(e);
        // Handle any potential errors during mapping
        return finalResult;
    }

    return finalResult;
}

function evaluateConditions(item, conditions, operators) {
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
    console.log(item)
    const { key, operator, value } = condition;
    switch (operator) {
        case '*': return true;
        case '>=': return item[key] >= Number(value);
        case '<=': return item[key] <= Number(value);
        case '==': return item[key] == value;
        case '>': return item[key] > Number(value);
        case '<': return item[key] < Number(value);
        case '!=': return item[key] != value;
        default: return false;
    }
}
