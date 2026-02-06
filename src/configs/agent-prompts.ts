// Agent Prompt Templates - Comprehensive Statistical Analysis Prompts

import { AnalysisTask, DatasetContext, Message } from '@/types/agent';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  version: string;
  category:
    | 'suggestion'
    | 'code_generation'
    | 'interpretation'
    | 'error_handling'
    | 'data_profiling';
}

export interface PromptContext {
  dataset: DatasetContext;
  userQuery: string;
  conversationHistory: Message[];
  selectedAnalysis?: AnalysisTask;
  previousResults?: any;
  dataQualityIssues?: string[];
}

// Base system prompt: concise, direct (Cursor-like)
export const SYSTEM_PROMPT = `You are a concise statistical analysis assistant. Use pandas, numpy, scipy, scikit-learn, matplotlib, seaborn, statsmodels when needed.

- Answer in short, direct sentences. No filler or long acknowledgments.
- Suggest methods and generate code when asked. Brief interpretation of results.
- On errors: brief explanation + one concrete suggestion.`;

// PROMPT TEMPLATES
export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // DATA EXPLORATION AND SUGGESTION PROMPTS
  {
    id: 'data_exploration',
    name: 'Data Exploration and Analysis Suggestions',
    description: 'Analyze dataset and suggest relevant statistical analyses',
    category: 'suggestion',
    version: '1.0',
    variables: ['dataset_context', 'user_query', 'conversation_history'],
    template: `Given this dataset with the following characteristics:

**Dataset Overview:**
- Total rows: {{dataset.totalRows}}
- Total columns: {{dataset.totalColumns}}
- Data quality score: {{dataset.dataQuality.overall}}/100

**Column Information:**
{{#each dataset.schema}}
- **{{name}}** ({{dataType}}): {{uniqueValues}} unique values, {{missingPercentage}}% missing
{{/each}}

**Sample Data (first 3 rows):**
{{#each dataset.sampleData}}
{{#each this}}
{{@key}}: {{this}}
{{/each}}
{{/each}}

**Data Quality Issues:**
{{#if dataQualityIssues}}
{{#each dataQualityIssues}}
- {{this}}
{{/each}}
{{else}}
No significant quality issues detected.
{{/if}}

**User Request:** {{user_query}}

**Recent Conversation Context:**
{{#each conversationHistory}}
{{role}}: {{content}}
{{/each}}

Based on this dataset and the user's request, please:

1. **Analyze the data characteristics** and identify key patterns
2. **Suggest 3-5 relevant statistical analyses** that would provide valuable insights
3. **Explain why each analysis is appropriate** for this data
4. **Highlight any data preprocessing needs** before analysis
5. **Recommend the best starting point** for the user's analysis journey

Focus on analyses that will provide actionable business insights. Consider the data types, sample sizes, and potential relationships between variables.`,
  },

  // CODE GENERATION PROMPTS
  {
    id: 'code_generation',
    name: 'Statistical Analysis Code Generation',
    description: 'Generate executable code for specific statistical analyses',
    category: 'code_generation',
    version: '1.0',
    variables: ['selected_analysis', 'dataset_context', 'user_query', 'parameters'],
    template: `Generate Python code to perform **{{selected_analysis.name}}** on this dataset.

**Analysis Details:**
- **Type:** {{selected_analysis.category}}
- **Description:** {{selected_analysis.description}}
- **Required Libraries:** {{selected_analysis.libraries.join(', ')}}
- **Estimated Time:** {{selected_analysis.estimatedTime}} seconds

**Dataset Context:**
- **Data Types:** {{#each dataset.schema}}{{dataType}}{{#unless @last}}, {{/unless}}{{/each}}
- **Sample Size:** {{dataset.totalRows}} rows
- **Quality Score:** {{dataset.dataQuality.overall}}/100

**User Parameters:** {{parameters}}

**Requirements:**
1. **Use the variable 'df'** for the dataset (it's already loaded)
2. **Include proper error handling** and data validation
3. **Add clear comments** explaining each step
4. **Handle missing data** appropriately ({{selected_analysis.dataRequirements.missingDataHandling}})
5. **Address outliers** as specified ({{selected_analysis.dataRequirements.outlierHandling}})
6. **Generate all expected outputs:** {{#each selected_analysis.outputFormats}}{{type}} ({{format}}){{#unless @last}}, {{/unless}}{{/each}}

**Code Structure:**
\`\`\`python
# Import required libraries
{{#each selected_analysis.libraries}}
import {{this}}
{{/each}}

# Data validation and preprocessing
# [Your preprocessing code here]

# Perform {{selected_analysis.name}}
# [Your analysis code here]

# Generate outputs
# [Your output generation code here]
\`\`\`

**Important:** Ensure the code is production-ready, follows Python best practices, and handles edge cases gracefully.`,
  },

  // RESULT INTERPRETATION PROMPTS
  {
    id: 'result_interpretation',
    name: 'Statistical Result Interpretation',
    description: 'Explain statistical results in business-friendly language',
    category: 'interpretation',
    version: '1.0',
    variables: ['analysis_results', 'selected_analysis', 'dataset_context', 'user_query'],
    template: `Interpret these statistical results from **{{selected_analysis.name}}** in business-friendly terms.

**Analysis Context:**
- **Type:** {{selected_analysis.category}}
- **Dataset:** {{dataset.totalRows}} rows, {{dataset.totalColumns}} columns
- **User Request:** {{user_query}}

**Results to Interpret:**
{{analysis_results}}

**Please provide:**

1. **Executive Summary** (2-3 sentences)
   - What are the key findings?
   - What do they mean for the business?

2. **Detailed Interpretation**
   - Explain significant results in plain English
   - Highlight important patterns or relationships
   - Note any surprising or unexpected findings

3. **Business Implications**
   - What actions should be considered?
   - What questions does this raise?
   - What follow-up analyses might be valuable?

4. **Confidence Level**
   - How confident are we in these results?
   - What limitations should be noted?
   - What assumptions were made?

5. **Next Steps**
   - Recommend specific follow-up analyses
   - Suggest data collection improvements if needed
   - Identify areas for deeper investigation

**Guidelines:**
- Use business language, not statistical jargon
- Focus on actionable insights
- Be specific about the magnitude and significance of findings
- Consider the practical implications for decision-making`,
  },

  // ERROR HANDLING PROMPTS
  {
    id: 'error_handling',
    name: 'Error Handling and Recovery',
    description: 'Handle code execution failures and suggest fixes',
    category: 'error_handling',
    version: '1.0',
    variables: ['error_message', 'failed_code', 'dataset_context', 'selected_analysis'],
    template: `The code execution failed with the following error:

**Error Message:**
{{error_message}}

**Failed Code:**
\`\`\`python
{{failed_code}}
\`\`\`

**Analysis Context:**
- **Analysis Type:** {{selected_analysis.name}}
- **Dataset:** {{dataset.totalRows}} rows, {{dataset.totalColumns}} columns
- **Data Types:** {{#each dataset.schema}}{{dataType}}{{#unless @last}}, {{/unless}}{{/each}}

**Please provide:**

1. **Error Diagnosis**
   - What caused this error?
   - Is it a data issue, code issue, or environment issue?

2. **Immediate Fixes**
   - Suggest specific code changes to resolve the error
   - Provide corrected code snippets
   - Address any data compatibility issues

3. **Alternative Approaches**
   - Suggest a simpler analysis method if the current approach is too complex
   - Recommend data preprocessing steps if needed
   - Propose a different statistical method that might work better

4. **Prevention Strategies**
   - How can similar errors be avoided in the future?
   - What validation checks should be added?
   - What data quality improvements are needed?

**Code Fix Example:**
\`\`\`python
# Original problematic code
{{failed_code}}

# Suggested fix
[Provide corrected code here]
\`\`\`

**Alternative Analysis:**
If the current approach continues to fail, consider: [suggest alternatives]`,
  },

  // DATA PROFILING PROMPTS
  {
    id: 'data_profiling',
    name: 'Comprehensive Data Profiling',
    description: 'Analyze data structure, quality, and characteristics',
    category: 'data_profiling',
    version: '1.0',
    variables: ['dataset_context', 'user_query'],
    template: `Perform a comprehensive data profiling analysis for this dataset.

**Dataset Overview:**
- **Size:** {{dataset.totalRows}} rows × {{dataset.totalColumns}} columns
- **Overall Quality Score:** {{dataset.dataQuality.overall}}/100

**Please analyze:**

1. **Data Structure Assessment**
   - Column types and their appropriateness
   - Missing data patterns and implications
   - Data consistency across columns
   - Potential data quality issues

2. **Statistical Summary**
   - Key statistics for numeric variables
   - Distribution characteristics
   - Outlier identification and assessment
   - Correlation patterns between variables

3. **Data Quality Issues**
   - Completeness (missing data analysis)
   - Consistency (data format and value consistency)
   - Accuracy (outlier detection, range validation)
   - Timeliness (if applicable)

4. **Preprocessing Recommendations**
   - Data cleaning steps needed
   - Transformation requirements
   - Handling of missing values
   - Outlier treatment strategies

5. **Analysis Readiness**
   - What analyses can be performed immediately?
   - What preprocessing is required first?
   - What data quality improvements would be most impactful?
   - Any limitations that should be noted?

**Output Format:**
Provide a structured analysis with clear sections, specific examples from the data, and actionable recommendations.`,
  },

  // ANALYSIS RECOMMENDATION PROMPTS
  {
    id: 'analysis_recommendation',
    name: 'Tailored Analysis Recommendations',
    description: 'Recommend specific analyses based on data characteristics and user goals',
    category: 'suggestion',
    version: '1.0',
    variables: ['dataset_context', 'user_query', 'conversation_history', 'data_quality_issues'],
    template: `Based on the dataset characteristics and user request, provide tailored analysis recommendations.

**User Goal:** {{user_query}}

**Dataset Profile:**
- **Size:** {{dataset.totalRows}} rows, {{dataset.totalColumns}} columns
- **Quality:** {{dataset.dataQuality.overall}}/100
- **Types:** {{#each dataset.schema}}{{dataType}}{{#unless @last}}, {{/unless}}{{/each}}

**Data Quality Assessment:**
{{#if dataQualityIssues}}
**Issues Found:**
{{#each dataQualityIssues}}
- {{this}}
{{/each}}
{{else}}
**Quality Status:** Good - No significant issues detected
{{/if}}

**Recommended Analysis Path:**

1. **Immediate Analyses** (can run now)
   - [List 2-3 analyses that can be performed immediately]
   - **Why:** [Explain why these are appropriate and valuable]

2. **Preprocessing Required** (need data cleaning first)
   - [List analyses that need data preparation]
   - **Preprocessing Steps:** [Specific steps needed]
   - **Expected Impact:** [How this will improve results]

3. **Advanced Analyses** (for deeper insights)
   - [List more complex analyses]
   - **Prerequisites:** [What needs to be done first]
   - **Business Value:** [Why these are worth the effort]

4. **Analysis Sequence**
   - **Step 1:** [First analysis to perform]
   - **Step 2:** [Follow-up based on Step 1 results]
   - **Step 3:** [Deeper analysis after initial insights]

**Success Criteria:**
- What insights should the user expect?
- How will they know the analysis was successful?
- What follow-up questions should they ask?

**Risk Mitigation:**
- What could go wrong?
- How to handle common issues?
- When to seek expert help?`,
  },
];

// PROMPT TEMPLATE MANAGEMENT FUNCTIONS
export const getPromptTemplate = (id: string): PromptTemplate | undefined => {
  return PROMPT_TEMPLATES.find(template => template.id === id);
};

export const getPromptTemplatesByCategory = (
  category: PromptTemplate['category']
): PromptTemplate[] => {
  return PROMPT_TEMPLATES.filter(template => template.category === category);
};

export const renderPromptTemplate = (template: PromptTemplate, context: PromptContext): string => {
  let rendered = template.template;

  // Replace dataset context variables
  rendered = rendered.replace(/\{\{dataset\.totalRows\}\}/g, context.dataset.totalRows.toString());
  rendered = rendered.replace(
    /\{\{dataset\.totalColumns\}\}/g,
    context.dataset.totalColumns.toString()
  );
  rendered = rendered.replace(
    /\{\{dataset\.dataQuality\.overall\}\}/g,
    context.dataset.dataQuality.overall.toString()
  );

  // Replace user query
  rendered = rendered.replace(/\{\{user_query\}\}/g, context.userQuery);

  // Replace selected analysis variables if available
  if (context.selectedAnalysis) {
    rendered = rendered.replace(/\{\{selected_analysis\.name\}\}/g, context.selectedAnalysis.name);
    rendered = rendered.replace(
      /\{\{selected_analysis\.category\}\}/g,
      context.selectedAnalysis.category
    );
    rendered = rendered.replace(
      /\{\{selected_analysis\.description\}\}/g,
      context.selectedAnalysis.description
    );
    rendered = rendered.replace(
      /\{\{selected_analysis\.libraries\.join\('\, '\)\}\}/g,
      context.selectedAnalysis.libraries.join(', ')
    );
    rendered = rendered.replace(
      /\{\{selected_analysis\.estimatedTime\}\}/g,
      context.selectedAnalysis.estimatedTime.toString()
    );
    rendered = rendered.replace(
      /\{\{selected_analysis\.dataRequirements\.missingDataHandling\}\}/g,
      context.selectedAnalysis.dataRequirements.missingDataHandling
    );
    rendered = rendered.replace(
      /\{\{selected_analysis\.dataRequirements\.outlierHandling\}\}/g,
      context.selectedAnalysis.dataRequirements.outlierHandling
    );
    rendered = rendered.replace(
      /\{\{selected_analysis\.outputFormats\.join\('\, '\)\}\}/g,
      context.selectedAnalysis.outputFormats.map(f => `${f.type} (${f.format})`).join(', ')
    );
  }

  // Replace conversation history
  if (context.conversationHistory) {
    const historyText = context.conversationHistory
      .slice(-5) // Last 5 messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
    rendered = rendered.replace(
      /\{\{#each conversationHistory\}\}([\s\S]*?)\{\{\/each\}\}/g,
      historyText
    );
  }

  // Replace data quality issues
  if (context.dataQualityIssues) {
    const issuesText = context.dataQualityIssues.map(issue => `- ${issue}`).join('\n');
    rendered = rendered.replace(
      /\{\{#each dataQualityIssues\}\}([\s\S]*?)\{\{\/each\}\}/g,
      issuesText
    );
  }

  // Replace dataset schema
  if (context.dataset.schema) {
    const schemaText = context.dataset.schema
      .map(
        col =>
          `- **${col.name}** (${col.dataType}): ${col.uniqueValues} unique values, ${col.missingPercentage}% missing`
      )
      .join('\n');
    rendered = rendered.replace(
      /\{\{#each dataset\.schema\}\}([\s\S]*?)\{\{\/each\}\}/g,
      schemaText
    );
  }

  // Replace sample data
  if (context.dataset.sampleData) {
    const sampleText = context.dataset.sampleData
      .slice(0, 3) // First 3 rows
      .map(row =>
        Object.entries(row)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')
      )
      .join('\n\n');
    rendered = rendered.replace(
      /\{\{#each dataset\.sampleData\}\}([\s\S]*?)\{\{\/each\}\}/g,
      sampleText
    );
  }

  return rendered;
};

// PROMPT SELECTION LOGIC
export const selectPromptTemplate = (
  context: PromptContext,
  category: PromptTemplate['category']
): PromptTemplate => {
  const templates = getPromptTemplatesByCategory(category);

  // For now, return the first template of the requested category
  // In the future, this could implement more sophisticated selection logic
  return templates[0] || PROMPT_TEMPLATES[0];
};

// PROMPT VERSIONING
export const getLatestPromptVersion = (id: string): string => {
  const template = getPromptTemplate(id);
  return template?.version || '1.0';
};

// PROMPT VALIDATION
export const validatePromptTemplate = (template: PromptTemplate): boolean => {
  return !!(
    template.id &&
    template.name &&
    template.template &&
    template.variables &&
    template.version &&
    template.category
  );
};
