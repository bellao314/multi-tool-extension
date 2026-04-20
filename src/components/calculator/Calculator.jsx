import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const BUTTON_ROWS = [
  ["C", "(", ")", "⌫"],
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["0", ".", "=", "+"],
];

function sanitizeExpression(expression) {
  const normalized = expression.replace(/×/g, "*").replace(/÷/g, "/").trim();

  if (!normalized) {
    throw new Error("Enter an expression to calculate.");
  }

  if (!/^[\d+\-*/().\s]+$/.test(normalized)) {
    throw new Error("Only numbers and basic operators are supported.");
  }

  return normalized;
}

function tokenizeExpression(expression) {
  const tokens = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (char === " ") {
      index += 1;
      continue;
    }

    const previousToken = tokens.at(-1);
    const isUnaryMinus =
      char === "-" &&
      (tokens.length === 0 || previousToken === "(" || ["+", "-", "*", "/"].includes(previousToken));

    if (/\d|\./.test(char) || isUnaryMinus) {
      let value = isUnaryMinus ? "-" : "";
      if (isUnaryMinus) {
        index += 1;
      }

      let hasDecimal = false;

      while (index < expression.length) {
        const current = expression[index];

        if (current === ".") {
          if (hasDecimal) {
            throw new Error("Invalid number format.");
          }
          hasDecimal = true;
          value += current;
          index += 1;
          continue;
        }

        if (!/\d/.test(current)) {
          break;
        }

        value += current;
        index += 1;
      }

      if (value === "-" || value === "." || value === "-.") {
        throw new Error("Invalid number format.");
      }

      tokens.push(value);
      continue;
    }

    if (["+", "-", "*", "/", "(", ")"].includes(char)) {
      tokens.push(char);
      index += 1;
      continue;
    }

    throw new Error("Only numbers and basic operators are supported.");
  }

  return tokens;
}

function toReversePolishNotation(tokens) {
  const output = [];
  const operators = [];
  const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };

  for (const token of tokens) {
    if (!Number.isNaN(Number(token))) {
      output.push(token);
      continue;
    }

    if (token === "(") {
      operators.push(token);
      continue;
    }

    if (token === ")") {
      while (operators.length > 0 && operators.at(-1) !== "(") {
        output.push(operators.pop());
      }

      if (operators.pop() !== "(") {
        throw new Error("Mismatched parentheses.");
      }

      continue;
    }

    while (
      operators.length > 0 &&
      operators.at(-1) !== "(" &&
      precedence[operators.at(-1)] >= precedence[token]
    ) {
      output.push(operators.pop());
    }

    operators.push(token);
  }

  while (operators.length > 0) {
    const operator = operators.pop();
    if (operator === "(") {
      throw new Error("Mismatched parentheses.");
    }
    output.push(operator);
  }

  return output;
}

function calculateRpn(tokens) {
  const stack = [];

  for (const token of tokens) {
    if (!Number.isNaN(Number(token))) {
      stack.push(Number(token));
      continue;
    }

    const right = stack.pop();
    const left = stack.pop();

    if (left === undefined || right === undefined) {
      throw new Error("That calculation couldn't be evaluated.");
    }

    if (token === "+") stack.push(left + right);
    if (token === "-") stack.push(left - right);
    if (token === "*") stack.push(left * right);
    if (token === "/") {
      if (right === 0) {
        throw new Error("Cannot divide by zero.");
      }
      stack.push(left / right);
    }
  }

  if (stack.length !== 1) {
    throw new Error("That calculation couldn't be evaluated.");
  }

  return stack[0];
}

function evaluateExpression(expression) {
  const sanitized = sanitizeExpression(expression);
  const tokens = tokenizeExpression(sanitized);
  const rpn = toReversePolishNotation(tokens);
  const result = calculateRpn(rpn);

  if (typeof result !== "number" || Number.isNaN(result) || !Number.isFinite(result)) {
    throw new Error("That calculation couldn't be evaluated.");
  }

  return Number.isInteger(result) ? String(result) : String(Number(result.toFixed(8)));
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload.data;
}

function getCalculationHistory(userId) {
  const params = new URLSearchParams({ userId });
  return apiRequest(`/api/calculator/history?${params.toString()}`, {
    method: "GET",
  });
}

function saveCalculation(expression, result, userId) {
  return apiRequest("/api/calculator/history", {
    method: "POST",
    body: JSON.stringify({ expression, result, userId }),
  });
}

export default function Calculator({ userId }) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      try {
        const data = await getCalculationHistory(userId);
        if (isMounted) {
          setHistory(data || []);
        }
      } catch (loadError) {
        console.error("calculator history load failed:", loadError);
        if (isMounted) {
          setError("Couldn't load calculation history.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const previewResult = useMemo(() => {
    if (!expression.trim()) return "";

    try {
      return evaluateExpression(expression);
    } catch {
      return "";
    }
  }, [expression]);

  function appendValue(value) {
    setError("");

    if (value === "=") {
      void handleEvaluate();
      return;
    }

    if (value === "C") {
      setExpression("");
      setResult("");
      return;
    }

    if (value === "⌫") {
      setExpression((current) => current.slice(0, -1));
      return;
    }

    setExpression((current) => `${current}${value}`);
  }

  async function handleEvaluate() {
    try {
      const computed = evaluateExpression(expression);
      setResult(computed);
      setIsSaving(true);
      setError("");

      await saveCalculation(expression, computed, userId);
      const updatedHistory = await getCalculationHistory(userId);
      setHistory(updatedHistory || []);
    } catch (evaluationError) {
      console.error("calculator evaluation failed:", evaluationError);
      setError(evaluationError.message || "Calculation failed.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    void handleEvaluate();
  }

  function handleHistoryItem(item) {
    setError("");
    setExpression(item.expression);
    setResult(String(item.result));
  }

  return (
    <div className="tool-panel calculator-panel">
      <div className="calc-hero">
        <div>
          <p className="section-title">Calculator</p>
          <h2 className="calc-title">Quick math with saved history</h2>
        </div>
        <span className="calc-history-pill">{history.length} saved</span>
      </div>

      <div className="calc-display calc-display-card">
        <span className="calc-display-label">Expression</span>
        <div className="calc-expr">{expression || "0"}</div>
        <div className="calc-result">
          {result ? `Result: ${result}` : previewResult ? `Preview: ${previewResult}` : "Result will appear here"}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <form className="calc-compose" onSubmit={handleSubmit}>
        <label className="calc-input-wrap" htmlFor="calc-expression">
          <span className="calc-display-label">Enter expression</span>
          <input
            id="calc-expression"
            className="calc-expression-input"
            value={expression}
            onChange={(event) => {
              setExpression(event.target.value);
              setError("");
            }}
            placeholder="(12.5 + 7) / 2"
            autoComplete="off"
          />
        </label>

        <div className="calc-grid" role="group" aria-label="Calculator keypad">
          {BUTTON_ROWS.flat().map((value) => {
            const variant =
              value === "=" ? "accent" : value === "C" || value === "⌫" ? "utility" : "";

            return (
              <button
                key={value}
                type="button"
                className={`calc-btn ${variant}`.trim()}
                onClick={() => appendValue(value)}
              >
                {value}
              </button>
            );
          })}
        </div>

        <div className="calc-actions">
          <button type="button" className="secondary-btn" onClick={() => appendValue("C")}>
            Clear
          </button>
          <button type="submit" className="accent-btn" disabled={!expression.trim() || isSaving}>
            {isSaving ? "Saving..." : "Calculate"}
          </button>
        </div>
      </form>

      <div className="history-list">
        <div className="calc-history-header">
          <h3 className="section-title">Recent Calculations</h3>
          {isLoadingHistory && <span className="calc-history-meta">Loading...</span>}
        </div>

        {!isLoadingHistory && history.length === 0 && (
          <div className="empty-state">No saved calculations yet. Try a few expressions to build your history.</div>
        )}

        {history.map((item) => (
          <button
            key={item.id ?? `${item.expression}-${item.timestamp}`}
            type="button"
            className="history-item calc-history-item"
            onClick={() => handleHistoryItem(item)}
          >
            <div className="calc-history-copy">
              <span className="hist-expr">{item.expression}</span>
              <span className="calc-history-time">{formatTimestamp(item.timestamp)}</span>
            </div>
            <span className="hist-result">= {item.result}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
