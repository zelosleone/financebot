import { z } from "zod";
import { tool } from "ai";
import { track } from "@vercel/analytics/server";
import { Daytona } from '@daytonaio/sdk';
import * as db from '@/lib/db';
import { randomUUID } from 'crypto';

// =============================================================================
// API HELPERS: Twelve Data, Alpha Vantage, Brave Search
// =============================================================================

/**
 * Call Twelve Data API for stock prices, fundamentals, and market data.
 * Supports 80+ global exchanges including Borsa Istanbul (BIST).
 * Free tier: 8 credits/minute (~800/day)
 */
async function callTwelveDataApi(
  endpoint: string,
  params: Record<string, string>
): Promise<any> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    throw new Error('TWELVE_DATA_API_KEY not configured');
  }

  const url = new URL(`https://api.twelvedata.com${endpoint}`);
  url.searchParams.set('apikey', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  console.log('[TwelveData] Calling:', endpoint, params);
  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Twelve Data API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.status === 'error') {
    throw new Error(data.message || 'Twelve Data API error');
  }

  return data;
}

/**
 * Call Alpha Vantage API for technical indicators and news sentiment.
 * Free tier: 25 requests/day, 5/minute
 */
async function callAlphaVantageApi(
  functionName: string,
  params: Record<string, string>
): Promise<any> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY not configured');
  }

  const url = new URL('https://www.alphavantage.co/query');
  url.searchParams.set('function', functionName);
  url.searchParams.set('apikey', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  console.log('[AlphaVantage] Calling:', functionName, params);
  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Alpha Vantage API error: ${response.status}`);
  }

  const data = await response.json();
  if (data['Error Message']) {
    throw new Error(data['Error Message']);
  }
  if (data['Note']) {
    throw new Error('Alpha Vantage rate limit reached. Try again later.');
  }

  return data;
}

/**
 * Call Brave Search API for web search, news, and SEC filings.
 * Free tier: 2,000 requests/month
 */
async function callBraveSearch(
  query: string,
  options?: {
    count?: number;
    domainFilter?: string[];
    freshness?: 'day' | 'week' | 'month' | 'year';
  }
): Promise<any> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error('BRAVE_SEARCH_API_KEY not configured');
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(options?.count || 10));

  if (options?.domainFilter && options.domainFilter.length > 0) {
    // Brave uses site: syntax in query for domain filtering
    const domainQuery = options.domainFilter.map(d => `site:${d}`).join(' OR ');
    url.searchParams.set('q', `${query} (${domainQuery})`);
  }

  if (options?.freshness) {
    url.searchParams.set('freshness', options.freshness);
  }

  console.log('[BraveSearch] Searching:', query);
  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Call Massive (formerly Polygon.io) API for stocks, options, and market data.
 * Free tier: 5 API calls/minute, 2 years historical, 100% US market coverage
 */
async function callMassiveApi(
  endpoint: string,
  params?: Record<string, string>
): Promise<any> {
  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) {
    throw new Error('MASSIVE_API_KEY not configured');
  }

  const url = new URL(`https://api.polygon.io${endpoint}`);
  url.searchParams.set('apiKey', apiKey);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  console.log('[Massive] Calling:', endpoint, params);
  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Massive API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}


export const financeTools = {
  // Chart Creation Tool - Create interactive financial charts with multiple chart types
  createChart: tool({
    description: `Create interactive charts for financial data visualization.

    CHART TYPES:
    1. "line" - Time series trends (stock prices, revenue over time)
    2. "bar" - Categorical comparisons (quarterly earnings, company comparisons)
    3. "area" - Cumulative data (stacked metrics, composition)
    4. "scatter" - Correlation analysis, positioning maps, bubble charts
    5. "quadrant" - 2x2 strategic matrix (BCG matrix, Edge Zone analysis)

    TIME SERIES CHARTS (line, bar, area):
    {
      "title": "Apple vs Microsoft Stock Performance",
      "type": "line",
      "xAxisLabel": "Date",
      "yAxisLabel": "Closing Price (USD)",
      "dataSeries": [
        {
          "name": "Apple (AAPL)",
          "data": [
            {"x": "2024-01-01", "y": 150.25},
            {"x": "2024-02-01", "y": 155.80}
          ]
        }
      ]
    }

    SCATTER/BUBBLE CHARTS (for positioning, correlation):
    Each SERIES represents a CATEGORY (for color coding).
    Each DATA POINT represents an individual entity with x, y, size, and label.
    {
      "title": "Investor Universe: Strategic Fit vs Deal Likelihood",
      "type": "scatter",
      "xAxisLabel": "Strategic Complementarity (1-10)",
      "yAxisLabel": "Acquisition Likelihood (1-10)",
      "dataSeries": [
        {
          "name": "Financial Sponsors",
          "data": [
            {"x": 8.5, "y": 7.2, "size": 5000, "label": "Goldman Sachs"},
            {"x": 9.0, "y": 8.5, "size": 8000, "label": "Vista Equity"}
          ]
        },
        {
          "name": "Strategic Acquirers",
          "data": [
            {"x": 9.5, "y": 6.8, "size": 3000, "label": "Salesforce"}
          ]
        }
      ]
    }

    QUADRANT CHARTS (2x2 strategic matrix):
    Same as scatter, but with reference lines dividing chart into 4 quadrants.
    Use for: Edge Zone analysis, BCG matrix, prioritization matrices.

    CRITICAL: ALL REQUIRED FIELDS MUST BE PROVIDED.`,
    inputSchema: z.object({
      title: z
        .string()
        .describe('Chart title (e.g., "Apple vs Microsoft Stock Performance")'),
      type: z
        .enum(["line", "bar", "area", "scatter", "quadrant"])
        .describe(
          'Chart type: "line" (time series), "bar" (comparisons), "area" (cumulative), "scatter" (positioning/correlation), "quadrant" (2x2 matrix)'
        ),
      xAxisLabel: z
        .string()
        .describe('X-axis label (e.g., "Date", "Strategic Fit (1-10)", "Risk")'),
      yAxisLabel: z
        .string()
        .describe(
          'Y-axis label (e.g., "Price ($)", "Alpha Potential (1-10)", "Return")'
        ),
      dataSeries: z
        .array(
          z.object({
            name: z
              .string()
              .describe(
                'Series name - For time series: company/ticker. For scatter/quadrant: category name for color coding (e.g., "Financial Sponsors", "Strategic Acquirers")'
              ),
            data: z
              .array(
                z.object({
                  x: z
                    .union([z.string(), z.number()])
                    .describe(
                      'X-axis value - Date string for time series, numeric value for scatter/quadrant'
                    ),
                  y: z
                    .number()
                    .describe(
                      "Y-axis numeric value - price, score, percentage, etc. REQUIRED for all chart types."
                    ),
                  size: z
                    .number()
                    .optional()
                    .describe(
                      'Bubble size for scatter/quadrant charts (e.g., deal size in millions, market cap). Larger = bigger bubble.'
                    ),
                  label: z
                    .string()
                    .optional()
                    .describe(
                      'Individual entity name for scatter/quadrant charts (e.g., "Goldman Sachs", "Microsoft"). Displayed on/near bubble.'
                    ),
                })
              )
              .describe(
                "Array of data points. For time series: {x: date, y: value}. For scatter/quadrant: {x, y, size, label}."
              ),
          })
        )
        .describe(
          "REQUIRED: Array of data series. For scatter/quadrant: each series = category for color coding, each point = individual entity"
        ),
      description: z
        .string()
        .optional()
        .describe("Optional description explaining what the chart shows"),
    }),
    execute: async ({
      title,
      type,
      xAxisLabel,
      yAxisLabel,
      dataSeries,
      description,
    }, options) => {
      const userId = (options as any)?.experimental_context?.userId;
      const sessionId = (options as any)?.experimental_context?.sessionId;

      // Calculate metadata based on chart type
      let dateRange = null;
      if (type === 'scatter' || type === 'quadrant') {
        // For scatter/quadrant charts, show x and y axis ranges
        const allXValues = dataSeries.flatMap(s => s.data.map(d => Number(d.x)));
        const allYValues = dataSeries.flatMap(s => s.data.map(d => d.y ?? 0));
        if (allXValues.length > 0 && allYValues.length > 0) {
          dateRange = {
            start: `X: ${Math.min(...allXValues).toFixed(1)}-${Math.max(...allXValues).toFixed(1)}`,
            end: `Y: ${Math.min(...allYValues).toFixed(1)}-${Math.max(...allYValues).toFixed(1)}`,
          };
        }
      } else {
        // For time series charts, show date/label range
        if (dataSeries.length > 0 && dataSeries[0].data.length > 0) {
          dateRange = {
            start: dataSeries[0].data[0].x,
            end: dataSeries[0].data[dataSeries[0].data.length - 1].x,
          };
        }
      }

      // Build chart data object
      const chartData = {
        chartType: type,
        title,
        xAxisLabel,
        yAxisLabel,
        dataSeries,
        description,
        metadata: {
          totalSeries: dataSeries.length,
          totalDataPoints: dataSeries.reduce(
            (sum, series) => sum + series.data.length,
            0
          ),
          dateRange,
        },
      };

      // Save chart to database (requires authenticated user)
      let chartId: string | null = null;
      try {
        if (!userId) {
          console.warn('[createChart] No user ID - chart will not be saved (authentication required)');
        } else {
          chartId = randomUUID();

          const insertData = {
            id: chartId,
            user_id: userId,
            session_id: sessionId || null,
            chart_data: chartData,
          };

          await db.createChart(insertData);
        }
      } catch (error) {
        console.error('[createChart] Error saving chart:', error);
        chartId = null;
      }

      // Track chart creation
      await track('Chart Created', {
        chartType: type,
        title: title,
        seriesCount: dataSeries.length,
        totalDataPoints: dataSeries.reduce(
          (sum, series) => sum + series.data.length,
          0
        ),
        hasDescription: !!description,
        hasScatterData: dataSeries.some(s => s.data.some(d => d.size || d.label)),
        savedToDb: !!chartId,
      });

      // Return chart data with chartId and imageUrl for markdown embedding
      return {
        ...chartData,
        chartId: chartId || undefined,
        imageUrl: chartId ? `/api/charts/${chartId}/image` : undefined,
      };
    },
  }),

  // CSV Creation Tool - Generate downloadable CSV files for financial data
  createCSV: tool({
    description: `Create downloadable CSV files for financial data, tables, and analysis results.

    USE CASES:
    - Export financial statements (balance sheet, income statement, cash flow)
    - Create comparison tables (company metrics, product performance)
    - Generate time series data exports
    - Build data tables for further analysis
    - Create custom financial reports

    REFERENCING CSVs IN MARKDOWN:
    After creating a CSV, you MUST reference it in your markdown response to display it as an inline table.

    CRITICAL - Use this EXACT format:
    ![csv](csv:csvId)

    Where csvId is the ID returned in the tool response.

    Example:
    - Tool returns: { csvId: "abc-123-def-456", ... }
    - In your response: "Here is the data:\n\n![csv](csv:abc-123-def-456)\n\n"

    The CSV will automatically render as a formatted markdown table. Do NOT use link syntax [text](csv:id), ONLY use image syntax ![csv](csv:id).

    IMPORTANT GUIDELINES:
    - Use descriptive column headers
    - Include units in headers when applicable (e.g., "Revenue (USD millions)")
    - Format numbers appropriately (use consistent decimal places)
    - Add a title/description to explain the data
    - Organize data logically (chronological, alphabetical, or by importance)

    EXAMPLE - Company Comparison:
    {
      "title": "Tech Giants - Financial Metrics Comparison Q3 2024",
      "description": "Key financial metrics for major technology companies",
      "headers": ["Company", "Market Cap (B)", "Revenue (B)", "Net Income (B)", "P/E Ratio", "Employees"],
      "rows": [
        ["Apple", "2,800", "383.3", "97.0", "28.9", "164,000"],
        ["Microsoft", "2,750", "211.9", "72.4", "35.2", "221,000"],
        ["Google", "1,700", "307.4", "73.8", "23.1", "182,000"]
      ]
    }

    EXAMPLE - Time Series Data:
    {
      "title": "Apple Stock Price - Last 12 Months",
      "description": "Monthly closing prices for AAPL",
      "headers": ["Date", "Open", "High", "Low", "Close", "Volume"],
      "rows": [
        ["2024-01-01", "185.23", "196.45", "184.12", "193.58", "125000000"],
        ["2024-02-01", "193.50", "199.20", "190.10", "197.45", "118000000"]
      ]
    }

    EXAMPLE - Financial Statement:
    {
      "title": "Apple Inc. - Income Statement FY2023",
      "description": "Consolidated statement of operations (in millions)",
      "headers": ["Item", "FY2023", "FY2022", "Change %"],
      "rows": [
        ["Net Sales", "383,285", "394,328", "-2.8%"],
        ["Cost of Revenue", "214,137", "223,546", "-4.2%"],
        ["Gross Profit", "169,148", "170,782", "-1.0%"],
        ["Operating Expenses", "55,013", "51,345", "7.1%"],
        ["Operating Income", "114,135", "119,437", "-4.4%"]
      ]
    }

    The CSV will be rendered as an interactive table with download capability.`,
    inputSchema: z.object({
      title: z.string().describe("Title for the CSV file (will be used as filename)"),
      description: z.string().optional().describe("Optional description of the data"),
      headers: z.array(z.string()).describe("Column headers for the CSV"),
      rows: z.array(z.array(z.string())).describe("Data rows - each row is an array matching the headers"),
    }),
    execute: async ({ title, description, headers, rows }, options) => {
      const userId = (options as any)?.experimental_context?.userId;
      const sessionId = (options as any)?.experimental_context?.sessionId;

      try {
        // Validate that all rows have the same number of columns as headers
        const headerCount = headers.length;
        const invalidRows = rows.filter(row => row.length !== headerCount);

        if (invalidRows.length > 0) {
          // Return error message instead of throwing - allows AI to continue
          return {
            error: true,
            message: `❌ **CSV Validation Error**: All rows must have ${headerCount} columns to match headers. Found ${invalidRows.length} invalid row(s). Please regenerate the CSV with matching column counts.`,
            title,
            headers,
            expectedColumns: headerCount,
            invalidRowCount: invalidRows.length,
          };
        }

        // Generate CSV content
        const csvContent = [
          headers.join(','),
          ...rows.map(row =>
            row.map(cell => {
              // Escape cells that contain commas, quotes, or newlines
              if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                return `"${cell.replace(/"/g, '""')}"`;
              }
              return cell;
            }).join(',')
          )
        ].join('\n');

        // Save CSV to database (requires authenticated user)
        let csvId: string | null = null;
        try {
          if (!userId) {
            console.warn('[createCSV] No user ID - CSV will not be saved (authentication required)');
          } else {
            csvId = randomUUID();

            const insertData = {
              id: csvId,
              user_id: userId,
              session_id: sessionId || null,
              title,
              description: description || undefined,
              headers,
              rows: rows,
            };

            await db.createCSV(insertData);
          }
        } catch (error) {
          console.error('[createCSV] Error saving CSV:', error);
          csvId = null;
        }

        // Track CSV creation
        await track('CSV Created', {
          title: title,
          rowCount: rows.length,
          columnCount: headers.length,
          hasDescription: !!description,
          savedToDb: !!csvId,
        });

        const result = {
          title,
          description,
          headers,
          rows,
          csvContent,
          rowCount: rows.length,
          columnCount: headers.length,
          csvId: csvId || undefined,
          csvUrl: csvId ? `/api/csvs/${csvId}` : undefined,
          _instructions: csvId
            ? `IMPORTANT: Include this EXACT line in your markdown response to display the table:\n\n![csv](csv:${csvId})\n\nDo not write [View Table] or any other text - use the image syntax above.`
            : undefined,
        };


        return result;
      } catch (error: any) {
        // Catch any unexpected errors and return error message
        return {
          error: true,
          message: `❌ **CSV Creation Error**: ${error.message || 'Unknown error occurred'}`,
          title,
        };
      }
    },
  }),

  codeExecution: tool({
    description: `Execute Python code securely in a Daytona Sandbox for financial modeling, data analysis, and calculations. CRITICAL: Always include print() statements to show results. Daytona can also capture rich artifacts (e.g., charts) when code renders images.

    ⚠️ CODE LENGTH LIMIT: Maximum 10,000 characters. Keep your code concise and focused.

    REQUIRED FORMAT - Your Python code MUST include print statements:
    
    Example for financial calculations:
    # Calculate compound interest
    principal = 10000
    rate = 0.07
    time = 5
    amount = principal * (1 + rate) ** time
    print(f"Initial investment: $\{principal:,.2f}")
    print(f"Annual interest rate: \{rate*100:.1f}%")
    print(f"Time period: \{time} years")
    print(f"Final amount: $\{amount:,.2f}")
    print(f"Interest earned: $\{amount - principal:,.2f}")
    
    Example for data analysis:
    import math
    values = [100, 150, 200, 175, 225]
    average = sum(values) / len(values)
    std_dev = math.sqrt(sum((x - average) ** 2 for x in values) / len(values))
    print(f"Data: \{values}")
    print(f"Average: \{average:.2f}")
    print(f"Standard deviation: \{std_dev:.2f}")
    
    IMPORTANT: 
    - Always end with print() statements showing final results
    - Use descriptive labels and proper formatting
    - Include units, currency symbols, or percentages where appropriate
    - Show intermediate steps for complex calculations`,
    inputSchema: z.object({
      code: z
        .string()
        .describe(
          "Python code to execute - MUST include print() statements to display results. Use descriptive output formatting with labels, units, and proper number formatting."
        ),
      description: z
        .string()
        .optional()
        .describe(
          'Brief description of what the calculation or analysis does (e.g., "Calculate future value with compound interest", "Analyze portfolio risk metrics")'
        ),
    }),
    execute: async ({ code, description }, options) => {
      const userId = (options as any)?.experimental_context?.userId;
      const sessionId = (options as any)?.experimental_context?.sessionId;
      const userTier = (options as any)?.experimental_context?.userTier;
      const isDevelopment = process.env.NEXT_PUBLIC_APP_MODE === 'development';

      const startTime = Date.now();

      try {

        // Check for reasonable code length
        if (code.length > 10000) {
          return '🚫 **Error**: Code too long. Please limit your code to 10,000 characters.';
        }

        // Initialize Daytona client
        const daytonaApiKey = process.env.DAYTONA_API_KEY;
        if (!daytonaApiKey) {
          return '❌ **Configuration Error**: Daytona API key is not configured. Please set DAYTONA_API_KEY in your environment.';
        }

        const daytona = new Daytona({
          apiKey: daytonaApiKey,
          // Optional overrides if provided
          serverUrl: process.env.DAYTONA_API_URL,
          target: (process.env.DAYTONA_TARGET as any) || undefined,
        });

        let sandbox: any | null = null;
        try {
          // Create a Python sandbox
          sandbox = await daytona.create({ language: 'python' });

          // Execute the user's code
          const execution = await sandbox.process.codeRun(code);
          const executionTime = Date.now() - startTime;

          // Track code execution
          await track('Python Code Executed', {
            success: execution.exitCode === 0,
            codeLength: code.length,
            outputLength: execution.result?.length || 0,
            executionTime: executionTime,
            hasDescription: !!description,
            hasError: execution.exitCode !== 0,
            hasArtifacts: !!execution.artifacts
          });

          // Note: Daytona execution billing is handled separately (not per-tool tracking)

          // Handle execution errors
          if (execution.exitCode !== 0) {
            // Provide helpful error messages for common issues
            let helpfulError = execution.result || 'Unknown execution error';
            if (helpfulError.includes('NameError')) {
              helpfulError = `${helpfulError}\n\n💡 **Tip**: Make sure all variables are defined before use. If you're trying to calculate something, include the full calculation in your code.`;
            } else if (helpfulError.includes('SyntaxError')) {
              helpfulError = `${helpfulError}\n\n💡 **Tip**: Check your Python syntax. Make sure all parentheses, quotes, and indentation are correct.`;
            } else if (helpfulError.includes('ModuleNotFoundError')) {
              helpfulError = `${helpfulError}\n\n💡 **Tip**: You can install packages inside the Daytona sandbox using pip if needed (e.g., pip install numpy).`;
            }

            return `❌ **Execution Error**: ${helpfulError}`;
          }

          // Format the successful execution result
          return `🐍 **Python Code Execution (Daytona Sandbox)**
${description ? `**Description**: ${description}\n` : ""}

\`\`\`python
${code}
\`\`\`

**Output:**
\`\`\`
${execution.result || "(No output produced)"}
\`\`\`

⏱️ **Execution Time**: ${executionTime}ms`;

        } finally {
          // Clean up sandbox
          try {
            if (sandbox) {
              await sandbox.delete();
            }
          } catch (cleanupError) {
          }
        }

      } catch (error: any) {

        return `❌ **Error**: Failed to execute Python code. ${error.message || 'Unknown error occurred'}`;
      }
    },
  }),

  financialSearch: tool({
    description: `Search for financial market data using Twelve Data and Alpha Vantage APIs.
    
    Supports:
    - Stock prices (real-time & historical) from 80+ exchanges including BIST (Turkey)
    - Forex and cryptocurrency rates
    - Company fundamentals (earnings, income statements, balance sheets)
    - Technical indicators (60+ available via Alpha Vantage)
    - Market news and sentiment analysis`,
    inputSchema: z.object({
      symbol: z
        .string()
        .describe(
          'Stock/crypto symbol (e.g., "AAPL", "THYAO.IS" for Turkish stocks, "BTC/USD" for crypto)'
        ),
      dataType: z
        .enum([
          "quote",
          "time_series",
          "earnings",
          "fundamentals",
          "technical",
          "news",
        ])
        .describe("Type of financial data to retrieve"),
      interval: z
        .enum(["1min", "5min", "15min", "30min", "1h", "4h", "1day", "1week", "1month"])
        .optional()
        .default("1day")
        .describe("Time interval for time series data"),
      outputSize: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .default(30)
        .describe("Number of data points to return"),
    }),
    execute: async ({ symbol, dataType, interval, outputSize }) => {
      try {
        let result: any;

        switch (dataType) {
          case "quote": {
            // Get current price from Twelve Data
            result = await callTwelveDataApi('/quote', { symbol });
            break;
          }

          case "time_series": {
            // Get historical prices from Twelve Data
            result = await callTwelveDataApi('/time_series', {
              symbol,
              interval: interval || '1day',
              outputsize: String(outputSize || 30),
            });
            break;
          }

          case "earnings": {
            // Get earnings from Twelve Data
            result = await callTwelveDataApi('/earnings', { symbol });
            break;
          }

          case "fundamentals": {
            // Get income statement from Twelve Data
            const income = await callTwelveDataApi('/income_statement', { symbol });
            const balance = await callTwelveDataApi('/balance_sheet', { symbol });
            result = { income_statement: income, balance_sheet: balance };
            break;
          }

          case "technical": {
            // Get technical indicators from Alpha Vantage (more comprehensive)
            const rsi = await callAlphaVantageApi('RSI', {
              symbol,
              interval: 'daily',
              time_period: '14',
              series_type: 'close',
            });
            const macd = await callAlphaVantageApi('MACD', {
              symbol,
              interval: 'daily',
              series_type: 'close',
            });
            result = { rsi, macd };
            break;
          }

          case "news": {
            // Get news and sentiment from Alpha Vantage
            result = await callAlphaVantageApi('NEWS_SENTIMENT', {
              tickers: symbol,
              limit: String(outputSize || 10),
            });
            break;
          }
        }

        // Track API call
        await track('Financial API Call', {
          toolType: 'financialSearch',
          symbol,
          dataType,
          provider: dataType === 'technical' || dataType === 'news' ? 'alpha_vantage' : 'twelve_data',
        });

        return JSON.stringify({
          type: "financial_data",
          symbol,
          dataType,
          data: result,
        }, null, 2);

      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('rate limit')) {
            return "⏱️ Rate limit exceeded. Please try again in a moment.";
          }
          if (error.message.includes('not configured')) {
            return `🔐 ${error.message}. Please set up your API keys.`;
          }
        }
        return `❌ Error fetching financial data: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  }),

  secFilingsSearch: tool({
    description: `Search SEC EDGAR filings (10-K, 10-Q, 8-K, etc.) using Brave Search with sec.gov domain filter.
    
    Use this to find:
    - Annual reports (10-K)
    - Quarterly reports (10-Q)
    - Current reports (8-K)
    - Insider trading filings (Form 4)
    - Proxy statements (DEF 14A)`,
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'SEC filing search query (e.g., "Apple 10-K 2024", "Tesla 8-K", "NVIDIA quarterly report")'
        ),
      maxResults: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .default(10)
        .describe("Maximum number of results to return"),
    }),
    execute: async ({ query, maxResults }) => {
      try {
        const response = await callBraveSearch(query, {
          count: maxResults || 10,
          domainFilter: ['sec.gov', 'edgar.sec.gov'],
        });

        // Track API call
        await track('Brave Search API Call', {
          toolType: 'secFilingsSearch',
          query,
          resultCount: response?.web?.results?.length || 0,
        });

        if (!response?.web?.results || response.web.results.length === 0) {
          return `🔍 No SEC filings found for "${query}". Try different keywords or company name.`;
        }

        const formattedResponse = {
          type: "sec_filings_search",
          query,
          resultCount: response.web.results.length,
          results: response.web.results.map((result: any) => ({
            title: result.title,
            url: result.url,
            description: result.description,
            age: result.age,
          })),
        };

        return JSON.stringify(formattedResponse, null, 2);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not configured')) {
            return `🔐 ${error.message}. Please set up your Brave Search API key.`;
          }
        }
        return `❌ Error searching SEC filings: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  }),

  webSearch: tool({
    description:
      "Search the web for general information using Brave Search API",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'Search query for any topic (e.g., "latest cryptocurrency news", "AI developments 2024")'
        ),
      maxResults: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .default(10)
        .describe("Maximum number of results to return"),
      freshness: z
        .enum(["day", "week", "month", "year"])
        .optional()
        .describe("Filter results by recency"),
    }),
    execute: async ({ query, maxResults, freshness }) => {
      try {
        const response = await callBraveSearch(query, {
          count: maxResults || 10,
          freshness,
        });

        // Track API call
        await track('Brave Search API Call', {
          toolType: 'webSearch',
          query,
          resultCount: response?.web?.results?.length || 0,
          ...(freshness && { freshness }),
        });

        if (!response?.web?.results || response.web.results.length === 0) {
          return `🔍 No web results found for "${query}". Try different keywords.`;
        }

        const formattedResponse = {
          type: "web_search",
          query,
          resultCount: response.web.results.length,
          results: response.web.results.map((result: any) => ({
            title: result.title,
            url: result.url,
            description: result.description,
            age: result.age,
          })),
        };

        return JSON.stringify(formattedResponse, null, 2);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not configured')) {
            return `🔐 ${error.message}. Please set up your Brave Search API key.`;
          }
          if (error.message.includes('429')) {
            return "⏱️ Rate limit exceeded. Please try again in a moment.";
          }
        }
        return `❌ Error performing web search: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  }),

  optionsSearch: tool({
    description: `Search options chain data using Massive (Polygon.io) API.
    
    Get options contracts, pricing, and Greeks for any US stock.
    Free tier: 5 API calls/minute, 2 years historical data.`,
    inputSchema: z.object({
      symbol: z
        .string()
        .describe('Stock symbol (e.g., "AAPL", "TSLA", "SPY")'),
      expirationDate: z
        .string()
        .optional()
        .describe('Expiration date filter (YYYY-MM-DD format)'),
      contractType: z
        .enum(["call", "put"])
        .optional()
        .describe('Filter by call or put options'),
    }),
    execute: async ({ symbol, expirationDate, contractType }) => {
      try {
        // Get options contracts for the symbol
        const params: Record<string, string> = {};
        if (expirationDate) params.expiration_date = expirationDate;
        if (contractType) params.contract_type = contractType;
        params.limit = '50';

        const result = await callMassiveApi(
          `/v3/reference/options/contracts`,
          { underlying_ticker: symbol, ...params }
        );

        // Track API call
        await track('Massive API Call', {
          toolType: 'optionsSearch',
          symbol,
          resultCount: result?.results?.length || 0,
        });

        if (!result?.results || result.results.length === 0) {
          return `🔍 No options contracts found for "${symbol}". Check if the symbol is correct.`;
        }

        return JSON.stringify({
          type: "options_data",
          symbol,
          expirationDate,
          contractType,
          contractCount: result.results.length,
          contracts: result.results.slice(0, 20).map((c: any) => ({
            ticker: c.ticker,
            expirationDate: c.expiration_date,
            strikePrice: c.strike_price,
            contractType: c.contract_type,
            shares: c.shares_per_contract,
          })),
        }, null, 2);

      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not configured')) {
            return `🔐 ${error.message}. Please set up your Massive API key.`;
          }
        }
        return `❌ Error fetching options data: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  }),

  massiveSearch: tool({
    description: `Search comprehensive market data using Massive (Polygon.io) API.
    
    Access stocks, options, indices, forex, and crypto data.
    Features: EOD data, minute bars, corporate actions, dividends, splits.
    Free tier: 5 API calls/minute, 2 years historical, 100% US market coverage.`,
    inputSchema: z.object({
      symbol: z
        .string()
        .describe('Ticker symbol (e.g., "AAPL", "X:BTCUSD" for crypto, "C:EURUSD" for forex)'),
      dataType: z
        .enum([
          "snapshot",
          "aggregates",
          "dividends",
          "splits",
          "financials",
          "ticker_details",
        ])
        .describe("Type of data to retrieve"),
      from: z
        .string()
        .optional()
        .describe('Start date for aggregates (YYYY-MM-DD)'),
      to: z
        .string()
        .optional()
        .describe('End date for aggregates (YYYY-MM-DD)'),
      timespan: z
        .enum(["minute", "hour", "day", "week", "month"])
        .optional()
        .default("day")
        .describe('Time span for aggregates'),
    }),
    execute: async ({ symbol, dataType, from, to, timespan }) => {
      try {
        let result: any;

        switch (dataType) {
          case "snapshot": {
            // Get current snapshot
            result = await callMassiveApi(`/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`);
            break;
          }

          case "aggregates": {
            // Get historical bars
            const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const toDate = to || new Date().toISOString().split('T')[0];
            result = await callMassiveApi(
              `/v2/aggs/ticker/${symbol}/range/1/${timespan || 'day'}/${fromDate}/${toDate}`,
              { limit: '100' }
            );
            break;
          }

          case "dividends": {
            result = await callMassiveApi(`/v3/reference/dividends`, { ticker: symbol, limit: '20' });
            break;
          }

          case "splits": {
            result = await callMassiveApi(`/v3/reference/splits`, { ticker: symbol, limit: '20' });
            break;
          }

          case "financials": {
            result = await callMassiveApi(`/vX/reference/financials`, { ticker: symbol, limit: '4' });
            break;
          }

          case "ticker_details": {
            result = await callMassiveApi(`/v3/reference/tickers/${symbol}`);
            break;
          }
        }

        // Track API call
        await track('Massive API Call', {
          toolType: 'massiveSearch',
          symbol,
          dataType,
        });

        return JSON.stringify({
          type: "massive_data",
          symbol,
          dataType,
          data: result,
        }, null, 2);

      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not configured')) {
            return `🔐 ${error.message}. Please set up your Massive API key.`;
          }
          if (error.message.includes('rate limit') || error.message.includes('429')) {
            return "⏱️ Rate limit exceeded. Please try again in a moment.";
          }
        }
        return `❌ Error fetching Massive data: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  }),
};
