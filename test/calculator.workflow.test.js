import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

function CalculatorPopup({
  evaluateExpression,
  supabaseApi,
  initialHistory = [],
  now = () => new Date().toISOString(),
}) {
  const [activeTab, setActiveTab] = React.useState("home");
  const [expression, setExpression] = React.useState("");
  const [result, setResult] = React.useState("");
  const [recentCalculations, setRecentCalculations] = React.useState([]);
  const [history, setHistory] = React.useState(initialHistory);

  async function handleCalculate() {
    const nextResult = String(evaluateExpression(expression));
    const timestamp = now();
    const newCalculation = {
      expression,
      result: nextResult,
      createdAt: timestamp,
    };

    setResult(nextResult);
    setRecentCalculations((current) => [newCalculation, ...current].slice(0, 10));

    await supabaseApi.insertCalculation(newCalculation);

    const count = await supabaseApi.getCalculationCount();
    if (count > 10) {
      await supabaseApi.deleteOldestCalculation();
    }

    const latestHistory = await supabaseApi.fetchLatestCalculations(10);
    setHistory(latestHistory);
  }

  return (
    <div>
      <h1>Multi-Tool Extension</h1>

      <button type="button" onClick={() => setActiveTab("calculator")}>
        Calculator
      </button>

      {activeTab === "calculator" ? (
        <section aria-label="Calculator panel">
          <label htmlFor="expression-input">Expression</label>
          <input
            id="expression-input"
            aria-label="Expression"
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
          />

          <button type="button" onClick={handleCalculate}>
            Calculate
          </button>

          <output aria-label="Result">{result}</output>

          <section aria-label="Recent Calculations">
            <ul>
              {recentCalculations.map((item) => (
                <li key={`${item.expression}-${item.createdAt}`}>
                  {item.expression} = {item.result}
                </li>
              ))}
            </ul>
          </section>

          <aside aria-label="History">
            <ul>
              {history.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => setExpression(item.result)}>
                    {item.expression} = {item.result}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </section>
      ) : null}
    </div>
  );
}

describe("Scientific Calculator Workflow", () => {
  const fixedTimestamp = "2026-03-29T10:15:00.000Z";

  let evaluateExpression;
  let supabaseApi;

  beforeEach(() => {
    global.chrome = {
      runtime: {
        id: "test-extension-id",
      },
    };

    evaluateExpression = vi.fn();
    supabaseApi = {
      insertCalculation: vi.fn().mockResolvedValue(undefined),
      getCalculationCount: vi.fn().mockResolvedValue(1),
      deleteOldestCalculation: vi.fn().mockResolvedValue(undefined),
      fetchLatestCalculations: vi.fn().mockResolvedValue([]),
    };
  });

  it("lets the user open the popup, switch to Calculator, enter a scientific expression, and see the local result immediately", async () => {
    evaluateExpression.mockImplementation(() => {
      expect(screen.getByLabelText("Result")).toHaveTextContent("");
      return 1;
    });

    render(
      <CalculatorPopup
        evaluateExpression={evaluateExpression}
        supabaseApi={supabaseApi}
        now={() => fixedTimestamp}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Calculator" }));
    fireEvent.change(screen.getByLabelText("Expression"), {
      target: { value: "sin(pi / 2)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    expect(evaluateExpression).toHaveBeenCalledWith("sin(pi / 2)");
    expect(screen.getByLabelText("Result")).toHaveTextContent("1");
    expect(screen.getByText("sin(pi / 2) = 1")).toBeInTheDocument();

    await waitFor(() => {
      expect(supabaseApi.insertCalculation).toHaveBeenCalledWith({
        expression: "sin(pi / 2)",
        result: "1",
        createdAt: fixedTimestamp,
      });
    });
  });

  it("supports keyboard-style input through the expression field and refreshes the History sidebar with the latest 10 Supabase rows", async () => {
    const latestHistory = Array.from({ length: 10 }, (_, index) => ({
      id: `calc-${index + 1}`,
      expression: `${index + 1}+${index + 1}`,
      result: String((index + 1) * 2),
      createdAt: `2026-03-29T10:${10 + index}:00.000Z`,
    }));

    evaluateExpression.mockReturnValue(3628800);
    supabaseApi.fetchLatestCalculations.mockResolvedValue(latestHistory);

    render(
      <CalculatorPopup
        evaluateExpression={evaluateExpression}
        supabaseApi={supabaseApi}
        now={() => fixedTimestamp}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Calculator" }));
    fireEvent.change(screen.getByLabelText("Expression"), {
      target: { value: "10!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    await waitFor(() => {
      expect(supabaseApi.fetchLatestCalculations).toHaveBeenCalledWith(10);
    });

    expect(screen.getByLabelText("Result")).toHaveTextContent("3628800");
    expect(screen.getByRole("button", { name: "1+1 = 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10+10 = 20" })).toBeInTheDocument();
  });

  it("deletes the oldest remote calculation when the user's Supabase count exceeds 10", async () => {
    evaluateExpression.mockReturnValue(4);
    supabaseApi.getCalculationCount.mockResolvedValue(11);

    render(
      <CalculatorPopup
        evaluateExpression={evaluateExpression}
        supabaseApi={supabaseApi}
        now={() => fixedTimestamp}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Calculator" }));
    fireEvent.change(screen.getByLabelText("Expression"), {
      target: { value: "sqrt(16)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    await waitFor(() => {
      expect(supabaseApi.deleteOldestCalculation).toHaveBeenCalledTimes(1);
    });
  });

  it("does not delete a remote record when the user's Supabase count is 10 or fewer", async () => {
    evaluateExpression.mockReturnValue(64);
    supabaseApi.getCalculationCount.mockResolvedValue(10);

    render(
      <CalculatorPopup
        evaluateExpression={evaluateExpression}
        supabaseApi={supabaseApi}
        now={() => fixedTimestamp}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Calculator" }));
    fireEvent.change(screen.getByLabelText("Expression"), {
      target: { value: "2^6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    await waitFor(() => {
      expect(supabaseApi.getCalculationCount).toHaveBeenCalledTimes(1);
    });

    expect(supabaseApi.deleteOldestCalculation).not.toHaveBeenCalled();
  });

  it("lets the user click a previous history result to reinsert it into the calculator input", async () => {
    const latestHistory = [
      {
        id: "calc-1",
        expression: "3 * 7",
        result: "21",
        createdAt: "2026-03-29T10:16:00.000Z",
      },
      {
        id: "calc-2",
        expression: "cos(0)",
        result: "1",
        createdAt: "2026-03-29T10:17:00.000Z",
      },
    ];

    evaluateExpression.mockReturnValue(42);
    supabaseApi.fetchLatestCalculations.mockResolvedValue(latestHistory);

    render(
      <CalculatorPopup
        evaluateExpression={evaluateExpression}
        supabaseApi={supabaseApi}
        now={() => fixedTimestamp}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Calculator" }));
    fireEvent.change(screen.getByLabelText("Expression"), {
      target: { value: "6 * 7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "3 * 7 = 21" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "3 * 7 = 21" }));

    expect(screen.getByLabelText("Expression")).toHaveValue("21");
  });
});
