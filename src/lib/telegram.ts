import { z } from "zod";

const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

const extractedTransactionSchema = z.object({
    merchant: z.string().trim().min(1),
    amount: z.coerce.number().positive(),
    category: z.string().trim().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const partialTransactionSchema = z.object({
    merchant: z.string().nullish(),
    amount: z.coerce.number().nullish(),
    category: z.string().nullish(),
    date: z.string().nullish(),
});

const llmResponseSchema = z.object({
    intent: z.enum(["not_transaction", "clarify", "single", "list"]),
    reason: z.string().optional(),
    question: z.string().optional(),
    suggested_category: z.string().optional(),
    missing_fields: z
        .array(z.enum(["merchant", "amount", "category", "date"]))
        .optional(),
    transaction: partialTransactionSchema.nullish(),
    transactions: z.array(partialTransactionSchema).nullish(),
});

const editTransactionsResponseSchema = z.object({
    intent: z.enum(["updated", "unchanged", "invalid"]),
    reason: z.string().optional(),
    transactions: z.array(extractedTransactionSchema).optional(),
});

const onboardingCategoriesSchema = z.object({
    categories: z.array(z.string().trim().min(1)),
});

export type ExtractedTransaction = z.infer<typeof extractedTransactionSchema>;
type PartialTransaction = z.infer<typeof partialTransactionSchema>;

export type TransactionParseResult =
    | { kind: "reject"; reason: string }
    | {
          kind: "clarify";
          question: string;
          missingFields: Array<"merchant" | "amount" | "category" | "date">;
          suggestedCategory?: string;
          draft: PartialTransaction;
      }
    | { kind: "single"; transaction: ExtractedTransaction }
    | { kind: "list"; transactions: ExtractedTransaction[] };

export type EditTransactionsResult =
    | { kind: "updated"; transactions: ExtractedTransaction[] }
    | { kind: "unchanged"; reason: string }
    | { kind: "invalid"; reason: string };

function toCompleteTransaction(transaction?: PartialTransaction | null) {
    if (!transaction) return null;
    const parsed = extractedTransactionSchema.safeParse(transaction);
    return parsed.success ? parsed.data : null;
}

export async function sendMessage(
    chatId: number,
    text: string,
    replyMarkup?: Record<string, unknown>,
) {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            reply_markup: replyMarkup,
            parse_mode: "HTML",
        }),
    });
    return response.json();
}

export async function answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
) {
    await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text,
        }),
    });
}

export async function parseTransactionWithLLM(
    text: string,
    categories: string[],
    referenceDate?: string,
) {
    const currentDate = referenceDate || new Date().toISOString().split("T")[0];
    const prompt = `
    Decide if the following message is not a transaction, a partial transaction that needs clarification, a single transaction, or a list of transactions.
    Message: "${text}"
    Current date is ${currentDate}.
    
    Categories available: ${categories.join(", ")}
    
    Return JSON only:
    {
      "intent": "not_transaction" | "clarify" | "single" | "list",
      "reason": "required when intent is not_transaction",
      "question": "required when intent is clarify",
      "suggested_category": "optional category suggestion when category is missing",
      "missing_fields": ["merchant" | "amount" | "category" | "date"],
      "transaction": {
        "merchant": "string",
        "amount": number,
        "category": "string",
        "date": "YYYY-MM-DD"
      },
      "transactions": [
        {
          "merchant": "string",
          "amount": number,
          "category": "string",
          "date": "YYYY-MM-DD"
        }
      ]
    }

    Rules:
    - Use "clarify" when the message is transaction-like but missing required details (example: missing merchant).
    - Use "single" for one complete transaction.
    - Use "list" for multiple complete transactions.
    - Never output empty strings for merchant/category/date.
    - If category is missing, include your best guess in "suggested_category".
  `;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 24000);

    try {
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "X-Title": "Budget Tracker Bot",
                },
                body: JSON.stringify({
                    model: "google/gemma-3-12b-it:free",
                    messages: [{ role: "user", content: prompt }],
                }),
                signal: controller.signal,
            },
        );

        if (!response.ok) throw new Error("OpenRouter API error");

        const result = await response.json();
        let content = result.choices?.[0]?.message?.content || "";
        content = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
        console.log("LLM response:", content);

        try {
            const parsed = llmResponseSchema.parse(JSON.parse(content));
            if (parsed.intent === "not_transaction") {
                return {
                    kind: "reject",
                    reason:
                        parsed.reason ||
                        'This does not look like a transaction. Please send something like "Spent 12.50 on lunch".',
                } satisfies TransactionParseResult;
            }

            if (parsed.intent === "clarify") {
                return {
                    kind: "clarify",
                    question:
                        parsed.question ||
                        "I can log that. Could you share the merchant name?",
                    missingFields: parsed.missing_fields || ["merchant"],
                    suggestedCategory: parsed.suggested_category,
                    draft: parsed.transaction || {},
                } satisfies TransactionParseResult;
            }

            if (parsed.intent === "single") {
                const extracted = toCompleteTransaction(parsed.transaction);
                if (extracted) {
                    return {
                        kind: "single",
                        transaction: extracted,
                    } satisfies TransactionParseResult;
                }

                return {
                    kind: "clarify",
                    question:
                        "I can log that. Could you share the missing transaction details?",
                    missingFields: parsed.missing_fields || ["merchant"],
                    suggestedCategory: parsed.suggested_category,
                    draft: parsed.transaction || {},
                } satisfies TransactionParseResult;
            }

            const transactions = (parsed.transactions || [])
                .map((transaction) => toCompleteTransaction(transaction))
                .filter((transaction): transaction is ExtractedTransaction =>
                    Boolean(transaction),
                );

            if (transactions.length === 1) {
                return {
                    kind: "single",
                    transaction: transactions[0],
                } satisfies TransactionParseResult;
            }

            if (transactions.length > 1) {
                return {
                    kind: "list",
                    transactions,
                } satisfies TransactionParseResult;
            }

            return {
                kind: "clarify",
                question:
                    "I found possible transactions but need more detail. Can you clarify the merchant names?",
                missingFields: parsed.missing_fields || ["merchant"],
                suggestedCategory: parsed.suggested_category,
                draft: parsed.transactions?.[0] || parsed.transaction || {},
            } satisfies TransactionParseResult;
        } catch {
            console.error("Failed to parse LLM response:", content);
            return {
                kind: "reject",
                reason: 'I couldn\'t parse a clear transaction. Please send something like "Spent 10 at Subway".',
            } satisfies TransactionParseResult;
        }
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            throw new Error("LLM_TIMEOUT");
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

export async function applyTransactionEditsWithLLM(
    instruction: string,
    transactions: ExtractedTransaction[],
    categories: string[],
    referenceDate?: string,
): Promise<EditTransactionsResult> {
    const currentDate = referenceDate || new Date().toISOString().split("T")[0];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const prompt = `
You are editing a draft list of transactions.
Current date is ${currentDate}.
Allowed categories: ${categories.join(", ")}

Current transactions JSON:
${JSON.stringify(transactions)}

User edit instruction:
"${instruction}"

Return JSON only:
{
  "intent": "updated" | "unchanged" | "invalid",
  "reason": "short reason if unchanged/invalid",
  "transactions": [
    {
      "merchant": "string",
      "amount": number,
      "category": "string",
      "date": "YYYY-MM-DD"
    }
  ]
}

Rules:
- If the instruction clearly updates one or more fields, return "updated" with the full updated transaction list.
- For "all dates are wrong, should be 2026-02-07", apply to every transaction date.
- Keep unchanged transactions as-is.
- If instruction is ambiguous, return "unchanged" or "invalid" with reason.
- Never return empty fields.
  `;

    try {
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "X-Title": "Budget Tracker Bot",
                },
                body: JSON.stringify({
                    model: "google/gemma-3-12b-it:free",
                    messages: [{ role: "user", content: prompt }],
                }),
                signal: controller.signal,
            },
        );

        if (!response.ok) throw new Error("OpenRouter API error");

        const result = await response.json();
        let content = result.choices?.[0]?.message?.content || "";
        content = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        try {
            const parsed = editTransactionsResponseSchema.parse(
                JSON.parse(content),
            );

            if (
                parsed.intent === "updated" &&
                parsed.transactions &&
                parsed.transactions.length > 0
            ) {
                return { kind: "updated", transactions: parsed.transactions };
            }

            if (parsed.intent === "unchanged") {
                return {
                    kind: "unchanged",
                    reason:
                        parsed.reason ||
                        "I understood your message but could not find a clear change to apply.",
                };
            }

            return {
                kind: "invalid",
                reason:
                    parsed.reason ||
                    "I could not apply that edit. Please be more specific.",
            };
        } catch {
            return {
                kind: "invalid",
                reason: "I could not parse that edit request. Try: 'set all dates to 2026-02-07'.",
            };
        }
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            throw new Error("LLM_TIMEOUT");
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

export async function suggestOnboardingCategoriesWithLLM(
    profileText: string,
): Promise<string[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const prompt = `
Suggest practical spending categories for a budgeting app user.

User profile:
"${profileText}"

Return JSON only:
{
  "categories": ["string"]
}

Rules:
- Return 8 to 15 category names.
- Use concise title case names.
- Avoid duplicates.
- Focus on everyday personal finance categories.
  `;

    try {
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "X-Title": "Budget Tracker Bot",
                },
                body: JSON.stringify({
                    model: "google/gemma-3-12b-it:free",
                    messages: [{ role: "user", content: prompt }],
                }),
                signal: controller.signal,
            },
        );

        if (!response.ok) throw new Error("OpenRouter API error");

        const result = await response.json();
        let content = result.choices?.[0]?.message?.content || "";
        content = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        try {
            const parsed = onboardingCategoriesSchema.parse(
                JSON.parse(content),
            );
            return Array.from(
                new Set(
                    parsed.categories
                        .map((name) => name.trim())
                        .filter((name) => name.length > 0),
                ),
            ).slice(0, 15);
        } catch {
            return [];
        }
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            throw new Error("LLM_TIMEOUT");
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
