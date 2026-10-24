/**
 * Safe Arithmetic & Cost Expression Parser
 * Strictly avoids `eval` and `Function` constructor.
 */

export type CalcParsedOutput = {
  isValid: boolean;
  error?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  lineAmount?: number;
  displayText?: string;
};

// Common units recognized in expressions
const UNIT_REGEX_PART = "(?:kg|g|pcs|piece|pieces|m|meter|meters|hr|hrs|hour|hours|set|sets|nos|nos\\.?|pkt|box)";

/**
 * Tokenize a math expression into numbers, operators, and parentheses.
 */
type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "%" }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenizeMath(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "");

  while (i < s.length) {
    const ch = s[i];

    if (ch === "+" || ch === "-") {
      tokens.push({ type: "op", value: ch });
      i++;
    } else if (ch === "*" || ch === "x" || ch === "X" || ch === "×") {
      tokens.push({ type: "op", value: "*" });
      i++;
    } else if (ch === "/" || ch === "÷") {
      tokens.push({ type: "op", value: "/" });
      i++;
    } else if (ch === "%") {
      tokens.push({ type: "op", value: "%" });
      i++;
    } else if (ch === "(") {
      tokens.push({ type: "lparen" });
      i++;
    } else if (ch === ")") {
      tokens.push({ type: "rparen" });
      i++;
    } else if (/^[0-9.]/.test(ch)) {
      let numStr = "";
      while (i < s.length && /^[0-9.]/.test(s[i])) {
        numStr += s[i];
        i++;
      }
      const num = Number(numStr);
      if (Number.isNaN(num)) return null;
      tokens.push({ type: "number", value: num });
    } else {
      // Unknown character
      return null;
    }
  }

  return tokens;
}

/**
 * Recursive descent parser for safe arithmetic evaluation.
 */
class SafeEvaluator {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  evaluate(): number {
    if (this.tokens.length === 0) throw new Error("Empty expression");
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error("Unexpected token after expression");
    }
    return result;
  }

  // Expression: Term (('+' | '-') Term)*
  private parseExpression(): number {
    let val = this.parseTerm();
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok.type === "op" && (tok.value === "+" || tok.value === "-")) {
        this.pos++;
        const nextVal = this.parseTerm();
        val = tok.value === "+" ? val + nextVal : val - nextVal;
      } else {
        break;
      }
    }
    return val;
  }

  // Term: Factor (('*' | '/' | '%') Factor)*
  private parseTerm(): number {
    let val = this.parseFactor();
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok.type === "op" && (tok.value === "*" || tok.value === "/" || tok.value === "%")) {
        this.pos++;
        const nextVal = this.parseFactor();
        if (tok.value === "*") {
          val = val * nextVal;
        } else if (tok.value === "/") {
          if (nextVal === 0) throw new Error("Cannot divide by zero");
          val = val / nextVal;
        } else if (tok.value === "%") {
          // e.g. 500 * 18% -> nextVal / 100
          val = val * (nextVal / 100);
        }
      } else {
        break;
      }
    }
    return val;
  }

  // Factor: unary ('+' | '-') Factor | Number | '(' Expression ')'
  private parseFactor(): number {
    if (this.pos >= this.tokens.length) throw new Error("Unexpected end of expression");
    const tok = this.tokens[this.pos];

    if (tok.type === "op" && (tok.value === "+" || tok.value === "-")) {
      this.pos++;
      const val = this.parseFactor();
      return tok.value === "-" ? -val : val;
    }

    if (tok.type === "lparen") {
      this.pos++;
      const val = this.parseExpression();
      if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== "rparen") {
        throw new Error("Missing closing parenthesis");
      }
      this.pos++; // consume ')'
      return val;
    }

    if (tok.type === "number") {
      this.pos++;
      return tok.value;
    }

    throw new Error("Syntax error in calculation");
  }
}

export function evaluateSafeMath(expr: string): { success: boolean; value?: number; error?: string } {
  const cleaned = expr.trim();
  if (!cleaned) return { success: false, error: "Expression is empty." };

  const tokens = tokenizeMath(cleaned);
  if (!tokens || tokens.length === 0) {
    return { success: false, error: "Invalid math characters in expression." };
  }

  try {
    const evaluator = new SafeEvaluator(tokens);
    const value = evaluator.evaluate();
    if (!Number.isFinite(value)) {
      return { success: false, error: "Result is not a finite number." };
    }
    return { success: true, value: Math.round(value * 100) / 100 };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Invalid arithmetic expression.",
    };
  }
}

/**
 * Parses costing input like:
 * - "15kg x 500" or "15 kg * 500" or "15kg × 500"
 * - "15 x 500"
 * - "500 x 15kg"
 * - "500" (with row quantity already set or empty)
 * - "500 + 50"
 */
export function parseCostExpression(
  expression: string,
  existingQty?: number | string,
  existingUnit?: string,
): CalcParsedOutput {
  const raw = expression.trim();
  if (!raw) {
    return { isValid: false, error: "Please enter an amount or formula." };
  }

  // 1. Check for Pattern: <qty>[unit] [xX*×] <rate_expr>
  // e.g. "15kg x 500", "15 kg * 500", "15.5 kg x 450 + 20"
  const qtyFirstRegex = new RegExp(
    `^([0-9]+(?:\\.[0-9]+)?)\\s*([a-zA-Z]+)?\\s*[xX*×]\\s*(.+)$`,
  );
  const qtyFirstMatch = raw.match(qtyFirstRegex);

  if (qtyFirstMatch) {
    const parsedQty = parseFloat(qtyFirstMatch[1]);
    const rawUnit = qtyFirstMatch[2]?.toLowerCase();
    const rateExpr = qtyFirstMatch[3].trim();

    const rateResult = evaluateSafeMath(rateExpr);
    if (!rateResult.success || rateResult.value === undefined) {
      return {
        isValid: false,
        error: rateResult.error || "Could not calculate the rate part.",
      };
    }

    const rate = rateResult.value;
    if (rate < 0) {
      return { isValid: false, error: "Price cannot be negative." };
    }
    if (parsedQty < 0) {
      return { isValid: false, error: "Quantity cannot be negative." };
    }

    const unit = rawUnit || existingUnit || "pcs";
    const lineAmount = Math.round(parsedQty * rate * 100) / 100;

    return {
      isValid: true,
      quantity: parsedQty,
      unit,
      rate,
      lineAmount,
      displayText: `${parsedQty} ${unit} × ₹${rate.toFixed(2)} = ₹${lineAmount.toFixed(2)}`,
    };
  }

  // 2. Check for Pattern: <rate_expr> [xX*×] <qty>[unit]
  // e.g. "500 x 15kg" or "500 * 15 kg"
  const rateFirstRegex = new RegExp(
    `^(.+?)\\s*[xX*×]\\s*([0-9]+(?:\\.[0-9]+)?)\\s*([a-zA-Z]+)$`,
  );
  const rateFirstMatch = raw.match(rateFirstRegex);

  if (rateFirstMatch) {
    const rateExpr = rateFirstMatch[1].trim();
    const parsedQty = parseFloat(rateFirstMatch[2]);
    const rawUnit = rateFirstMatch[3]?.toLowerCase();

    const rateResult = evaluateSafeMath(rateExpr);
    if (!rateResult.success || rateResult.value === undefined) {
      return {
        isValid: false,
        error: rateResult.error || "Could not calculate the rate part.",
      };
    }

    const rate = rateResult.value;
    if (rate < 0) {
      return { isValid: false, error: "Price cannot be negative." };
    }
    if (parsedQty < 0) {
      return { isValid: false, error: "Quantity cannot be negative." };
    }

    const unit = rawUnit || existingUnit || "pcs";
    const lineAmount = Math.round(parsedQty * rate * 100) / 100;

    return {
      isValid: true,
      quantity: parsedQty,
      unit,
      rate,
      lineAmount,
      displayText: `${parsedQty} ${unit} × ₹${rate.toFixed(2)} = ₹${lineAmount.toFixed(2)}`,
    };
  }

  // 3. Check for standard arithmetic expression:
  // e.g. "500", "500 + 50", "200 * 3"
  const mathResult = evaluateSafeMath(raw);
  if (!mathResult.success || mathResult.value === undefined) {
    return {
      isValid: false,
      error: mathResult.error || "Invalid calculation expression.",
    };
  }

  const evaluatedVal = mathResult.value;
  if (evaluatedVal < 0) {
    return { isValid: false, error: "Result cannot be negative." };
  }

  // If the row already has a quantity entered (e.g. 15 kg),
  // then entering "500" means the unit rate is 500, and lineAmount = 15 * 500 = 7500.
  const numExistingQty =
    existingQty !== undefined && existingQty !== ""
      ? parseFloat(String(existingQty))
      : NaN;

  if (!Number.isNaN(numExistingQty) && numExistingQty > 0) {
    const lineAmount = Math.round(numExistingQty * evaluatedVal * 100) / 100;
    const unit = existingUnit || "pcs";
    return {
      isValid: true,
      quantity: numExistingQty,
      unit,
      rate: evaluatedVal,
      lineAmount,
      displayText: `${numExistingQty} ${unit} × ₹${evaluatedVal.toFixed(2)} = ₹${lineAmount.toFixed(2)}`,
    };
  }

  // If no quantity specified in row: rate is evaluatedVal, lineAmount is evaluatedVal
  return {
    isValid: true,
    rate: evaluatedVal,
    lineAmount: evaluatedVal,
    unit: existingUnit || "pcs",
    displayText: `₹${evaluatedVal.toFixed(2)}`,
  };
}
