function evaluateSingleCondition(condition, context = {}) {
  const { field, operator, value } = condition;
  if (!field || !operator) return true;

  // Extract field value from context (supports nested fields e.g. "member.roles")
  const extracted = field.split('.').reduce((obj, key) => obj?.[key], context);
  let actualVal = extracted !== undefined ? extracted : field;

  switch (operator.toLowerCase()) {
    case "=":
    case "==":
    case "equals":
      return String(actualVal) === String(value);

    case "!=":
    case "notequals":
      return String(actualVal) !== String(value);

    case ">":
    case "greater_than":
    case "greaterthan":
      return Number(actualVal) > Number(value);

    case "<":
    case "less_than":
    case "lessthan":
      return Number(actualVal) < Number(value);

    case ">=":
    case "greater_than_or_equals":
      return Number(actualVal) >= Number(value);

    case "<=":
    case "less_than_or_equals":
      return Number(actualVal) <= Number(value);

    case "contains":
      if (Array.isArray(actualVal)) return actualVal.includes(value);
      return String(actualVal || "").toLowerCase().includes(String(value || "").toLowerCase());

    case "notContains":
      if (Array.isArray(actualVal)) return !actualVal.includes(value);
      return !String(actualVal || "").toLowerCase().includes(String(value || "").toLowerCase());

    case "startsWith":
      return String(actualVal || "").toLowerCase().startsWith(String(value || "").toLowerCase());

    case "endsWith":
      return String(actualVal || "").toLowerCase().endsWith(String(value || "").toLowerCase());

    case "in": {
      const list = Array.isArray(value) ? value : String(value).split(',').map(s => s.trim());
      return list.includes(String(actualVal));
    }

    case "notIn": {
      const list = Array.isArray(value) ? value : String(value).split(',').map(s => s.trim());
      return !list.includes(String(actualVal));
    }

    case "matchesRegex":
      try {
        const regex = new RegExp(value, 'i');
        return regex.test(String(actualVal || ""));
      } catch {
        return false;
      }

    case "exists":
      return actualVal !== undefined && actualVal !== null && actualVal !== "";

    case "isNull":
      return actualVal === undefined || actualVal === null || actualVal === "";

    default:
      return true;
  }
}

function evaluateRuleGroup(ruleGroup, context = {}) {
  if (!ruleGroup || !Array.isArray(ruleGroup.conditions) || ruleGroup.conditions.length === 0) {
    return true;
  }

  const mode = (ruleGroup.match || "ALL").toUpperCase(); // "ALL" (AND) or "ANY" (OR)

  if (mode === "ANY") {
    return ruleGroup.conditions.some(cond => evaluateSingleCondition(cond, context));
  } else {
    return ruleGroup.conditions.every(cond => evaluateSingleCondition(cond, context));
  }
}

function evaluateCondition(actualVal, operator, value) {
  return evaluateSingleCondition({ field: "val", operator, value }, { val: actualVal });
}

function evaluateConditionGroup(conditions, match = "ALL", context = {}) {
  return evaluateRuleGroup({ match, conditions }, context);
}

module.exports = {
  evaluateSingleCondition,
  evaluateRuleGroup,
  evaluateCondition,
  evaluateConditionGroup
};
