'use server'

import { z } from 'zod'

const PROMPT_IMAGE_ANALYSIS = (categories?: string[]) => `
Analyse this receipt and extract both the header information and the individual line items.
For line items, if a purchase contains items that belong to different categories (e.g., groceries vs household supplies), list them separately.
If the categories provided are not enough to categorise the items, you can create new categories.
Return the information in the following JSON format only:
{
  "merchant": "Merchant Name",
  "total_amount": 125.50,
  "date": "YYYY-MM-DD",
  "main_category": "The best fit category for the overall purchase",
  "items": [
    {
      "description": "Item name (e.g. Bread)",
      "amount": 2.50,
      "category": "Chosen from: ${categories ? categories.join(', ') : 'General'}"
    }
  ]
}

IMPORTANT: All "amount" fields MUST be numbers, not strings. Do not use quotes around numerical values.
`

// Define the extraction schema
const receiptItemSchema = z.object({
  description: z.string(),
  amount: z.coerce.number(),
  category: z.string(),
})

const receiptSchema = z.object({
  merchant: z.string(),
  total_amount: z.coerce.number(),
  date: z.string(),
  main_category: z.string(),
  items: z.array(receiptItemSchema),
})

export async function scanReceipt(image: string, availableCategories?: string[]) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000", // Required for some OpenRouter models
        "X-Title": "Budget Tracker", // Recommended for better logging
      },
      body: JSON.stringify({
        "model": "google/gemma-3-12b-it:free",
        "messages": [
          {
            "role": "user",
            "content": [
              {
                "type": "text",
                "text": PROMPT_IMAGE_ANALYSIS(availableCategories)
              },
              {
                "type": "image_url",
                "image_url": {
                  "url": image
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const result = await response.json();
    let content = result.choices?.[0]?.message?.content;
    content = content.replace('```json', '').replace('```', '')
    console.log(content)
    
    if (!content) throw new Error('No content received from model');

    // Parse the JSON string returned by the model
    const data = JSON.parse(content);
    
    // Validate schema
    const parsed = receiptSchema.parse(data);

    return { success: true, data: parsed }
  } catch (error) {
    console.error('Receipt scanning failed:', error)
    return { success: false }
  }
}