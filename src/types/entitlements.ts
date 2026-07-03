export interface Entitlements {
  can_use_ai_assistant: boolean;
  can_generate_reports: boolean;
  max_team_seats: number;
  assistant_limit_monthly: number;
  assistant_cost_budget_usd_micros_monthly: number;
  report_limit_monthly: number;
  plan_code: string;
}
